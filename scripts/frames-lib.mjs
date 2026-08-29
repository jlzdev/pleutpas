import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import palette from '../src/lib/palette.json' with { type: 'json' }

const PALETTE = palette.steps.map((s) => [
  s.mm,
  parseInt(s.hex.slice(1, 3), 16),
  parseInt(s.hex.slice(3, 5), 16),
  parseInt(s.hex.slice(5, 7), 16),
])

const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const invMerc = (y) => (Math.atan(Math.exp(y)) - Math.PI / 4) * (360 / Math.PI)

function colorFor(mm) {
  if (!Number.isFinite(mm) || mm < PALETTE[0][0]) return null
  let c = PALETTE[0]
  for (const p of PALETTE) if (mm >= p[0]) c = p
  return c
}

// l'API renvoie parfois un fault XML avec un statut 200, d'ou la validation du contenu
async function mf(key, url, check, attempts = 4) {
  for (let i = 1; ; i++) {
    let detail = ''
    try {
      const res = await fetch(url, { headers: { apikey: key }, signal: AbortSignal.timeout(60000) })
      detail = 'http ' + res.status + ' ' + (res.headers.get('content-type') || '')
      if (res.ok) {
        const out = await check(res)
        if (out !== null) return out
      }
      if (i >= attempts) throw new Error(detail)
    } catch (e) {
      if (i >= attempts) throw e instanceof Error ? e : new Error(detail)
    }
    await new Promise((r) => setTimeout(r, 5000 * i))
  }
}

// le catalogue est parfois servi valide mais vide (rechargement cote MF), d'ou la
// validation des runs dans la boucle de retries plutot qu'apres coup
const mfRuns = (key, url, runRe) => mf(key, url, async (res) => {
  const txt = await res.text()
  if (!txt.includes('<wcs:')) return null
  const found = [...txt.matchAll(runRe)]
  return found.length ? found : null
})

// une indisponibilite passagere de MF ne doit pas peindre le run en rouge : la branche de
// donnees publiee reste servie et le prochain tick retente dans quelques minutes
export function bail(prevRun, maxAgeMs, msg) {
  console.error(msg)
  const age = Date.now() - Date.parse(prevRun || '')
  if (Number.isFinite(age) && Math.abs(age) <= maxAgeMs) {
    console.log('le run publie ' + prevRun + ' reste recent, nouvel essai au prochain tick')
    process.exit(0)
  }
  console.error(prevRun ? 'dernier run publie ' + prevRun + ' trop vieux ou illisible' : 'aucun run publie')
  process.exit(1)
}

// runRe doit capturer l'horodatage du run dans un groupe nomme "run"
export async function catalogRuns(key, api, runRe, giveUp) {
  let found
  try {
    found = await mfRuns(key, api + '/GetCapabilities?service=WCS&version=2.0.1&language=eng', runRe)
  } catch (e) {
    giveUp('GetCapabilities indisponible ou sans run attendu (' + e.message + ')')
  }
  const all = new Set(found.map((m) => m.groups.run))
  return { found, all, runs: [...all].sort().reverse().slice(0, 3) }
}

const mfTiff = (key, url) => mf(key, url, async (res) => {
  if (!(res.headers.get('content-type') || '').includes('tiff')) return null
  return res.arrayBuffer()
})

function colorize(data, width, height, north, south, mmScale, shrink) {
  const outW = Math.ceil(width / shrink)
  const outH = Math.ceil(height / shrink)
  const png = new PNG({ width: outW, height: outH })
  const yTop = merc(north)
  const yBot = merc(south)
  let maxMm = 0
  for (let j = 0; j < outH; j++) {
    const lat = invMerc(yTop + ((yBot - yTop) * (j + 0.5)) / outH)
    const src = Math.max(0, Math.min(height - 1, Math.round(((north - lat) / (north - south)) * height - 0.5)))
    for (let i = 0; i < outW; i++) {
      const srcI = Math.min(width - 1, Math.floor((i + 0.5) * shrink))
      const v = data[src * width + srcI] * mmScale
      if (Number.isFinite(v) && v > maxMm) maxMm = v
      const c = colorFor(v)
      const o = (j * outW + i) * 4
      if (c) {
        png.data[o] = c[1]
        png.data[o + 1] = c[2]
        png.data[o + 2] = c[3]
        png.data[o + 3] = 255
      }
    }
  }
  return { buffer: PNG.sync.write(png), maxMm: +maxMm.toFixed(2) }
}

export async function buildFrame({ key, api, subset, outDir, mmScale = 1, shrink = 1 }, coverageId, tMs) {
  const iso = new Date(tMs).toISOString().replace('.000', '')
  const buf = await mfTiff(key, api + '/GetCoverage?service=WCS&version=2.0.1&coverageid=' + coverageId
    + '&subset=time(' + iso + ')' + subset)
  const tiff = await fromArrayBuffer(buf)
  const image = await tiff.getImage()
  const [west, south, east, north] = image.getBoundingBox()
  const rasters = await image.readRasters()
  const { buffer, maxMm } = colorize(rasters[0], image.getWidth(), image.getHeight(), north, south, mmScale, shrink)
  const file = 'frames/' + iso.slice(0, 16).replace(/[-:]/g, '') + 'Z.png'
  writeFileSync(outDir + '/' + file, buffer)
  console.log(iso + ' -> ' + file + ' (max ' + maxMm + ' mm/15 min)')
  return { time: tMs / 1000, file, maxMm, bbox: [west, south, east, north] }
}

export async function buildRun(cfg, coverageId, steps, minFrames) {
  const results = []
  let next = 0
  let fails = 0
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < steps.length && fails <= steps.length - minFrames) {
      const i = next++
      try {
        results[i] = await buildFrame(cfg, coverageId, steps[i])
      } catch (e) {
        fails++
        console.error('frame ' + new Date(steps[i]).toISOString() + ' abandonnee : ' + e.message)
      }
    }
  }))
  return results.filter(Boolean)
}

export async function resolvePrevRun(manifestUrl) {
  // en CI, PREV_RUN vient de la branche de donnees via git (le CDN raw a un cache de 300 s
  // qui rend la deduplication faillible) ; vide (echec du fetch git) -> repli sur le CDN
  if (process.env.PREV_RUN) return process.env.PREV_RUN
  const prev = await fetch(manifestUrl).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  return prev && prev.run ? prev.run : ''
}

export function writeManifest(outDir, model, runIso, frames, past = []) {
  const [west, south, east, north] = frames[0].bbox
  writeFileSync(outDir + '/manifest.json', JSON.stringify({
    run: runIso,
    generatedAt: new Date().toISOString(),
    model,
    bounds: [[south, west], [north, east]],
    frames: frames.map(({ time, file, maxMm }) => ({ time, file, maxMm })),
    ...(past.length ? { past: past.map(({ time, file, maxMm }) => ({ time, file, maxMm })) } : {}),
  }))
}
