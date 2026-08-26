import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const API = 'https://public-api.meteofrance.fr/public/aromepi/1.0/wcs/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WCS'
const MANIFEST_URL = 'https://raw.githubusercontent.com/jlzdev/pleutpas/data/manifest.json'
const SUBSET = '&subset=lat(41,51.5)&subset=long(-5.5,10)&format=image/tiff'
const OUT = 'out'
// la meme donnee est indexee sous deux dialectes d'identifiants selon le backend qui repond
const FAMILIES = ['PRECIP__GROUND', 'TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE']

const PALETTE = [
  [0.1, 0x6e, 0xe7, 0xdc],
  [0.25, 0x4a, 0xa8, 0xff],
  [0.75, 0x7c, 0x6c, 0xff],
  [2, 0xe0, 0x5c, 0xe0],
  [5, 0xff, 0x5c, 0x47],
  [12, 0xff, 0xd2, 0x3f],
]

const key = process.env.MF_API_KEY
if (!key) {
  console.error('MF_API_KEY manquant')
  process.exit(1)
}

const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const invMerc = (y) => (Math.atan(Math.exp(y)) - Math.PI / 4) * (360 / Math.PI)

function colorFor(mm) {
  if (!Number.isFinite(mm) || mm < PALETTE[0][0]) return null
  let c = PALETTE[0]
  for (const p of PALETTE) if (mm >= p[0]) c = p
  return c
}

// l'API renvoie parfois un fault XML avec un statut 200, d'ou la validation du contenu
async function mf(url, check, attempts = 4) {
  for (let i = 1; ; i++) {
    let detail = ''
    try {
      const res = await fetch(url, { headers: { apikey: key } })
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

const mfXml = (url) => mf(url, async (res) => {
  const txt = await res.text()
  return txt.includes('<wcs:') ? txt : null
})

const mfTiff = (url) => mf(url, async (res) => {
  if (!(res.headers.get('content-type') || '').includes('tiff')) return null
  return res.arrayBuffer()
})

function colorize(data, width, height, north, south) {
  const png = new PNG({ width, height })
  const yTop = merc(north)
  const yBot = merc(south)
  let maxMm = 0
  for (let j = 0; j < height; j++) {
    const lat = invMerc(yTop + ((yBot - yTop) * (j + 0.5)) / height)
    const src = Math.max(0, Math.min(height - 1, Math.round(((north - lat) / (north - south)) * height - 0.5)))
    for (let i = 0; i < width; i++) {
      const v = data[src * width + i]
      if (Number.isFinite(v) && v > maxMm) maxMm = v
      const c = colorFor(v)
      const o = (j * width + i) * 4
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

async function buildFrame(coverageId, tMs) {
  const iso = new Date(tMs).toISOString().replace('.000', '')
  const buf = await mfTiff(API + '/GetCoverage?service=WCS&version=2.0.1&coverageid=' + coverageId
    + '&subset=time(' + iso + ')' + SUBSET)
  const tiff = await fromArrayBuffer(buf)
  const image = await tiff.getImage()
  const [west, south, east, north] = image.getBoundingBox()
  const rasters = await image.readRasters()
  const { buffer, maxMm } = colorize(rasters[0], image.getWidth(), image.getHeight(), north, south)
  const file = 'frames/' + iso.slice(0, 16).replace(/[-:]/g, '') + 'Z.png'
  writeFileSync(OUT + '/' + file, buffer)
  console.log(iso + ' -> ' + file + ' (max ' + maxMm + ' mm/15 min)')
  return { time: tMs / 1000, file, maxMm, bbox: [west, south, east, north] }
}

const caps = await mfXml(API + '/GetCapabilities?service=WCS&version=2.0.1&language=eng')
const runRe = new RegExp('(' + FAMILIES.join('|') + ')___(\\d{4}-\\d{2}-\\d{2}T\\d{2}\\.\\d{2}\\.\\d{2}Z)_PT15M', 'g')
const found = [...caps.matchAll(runRe)]
if (!found.length) {
  console.error('aucun run pluie PT15M dans le GetCapabilities')
  process.exit(1)
}
const runId = [...new Set(found.map((m) => m[2]))].sort().at(-1)
const family = found.find((m) => m[2] === runId)[1]
const coverageId = family + '___' + runId + '_PT15M'
const runIso = runId.replaceAll('.', ':')

const prev = await fetch(MANIFEST_URL).then((r) => (r.ok ? r.json() : null)).catch(() => null)
if (prev && prev.run === runIso) {
  console.log('rien de neuf, run ' + runIso + ' deja publie')
  process.exit(0)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT + '/frames', { recursive: true })

const runMs = Date.parse(runIso)
const steps = Array.from({ length: 24 }, (_, k) => runMs + (k + 1) * 900000)
const results = []
let next = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < steps.length) {
    const i = next++
    try {
      results[i] = await buildFrame(coverageId, steps[i])
    } catch (e) {
      console.error('frame ' + new Date(steps[i]).toISOString() + ' abandonnee : ' + e.message)
      results[i] = null
    }
  }
}))

const frames = results.filter(Boolean)
if (frames.length < 12) {
  console.error('run ' + runIso + ' incomplet (' + frames.length + '/24 frames), publication annulee')
  rmSync(OUT, { recursive: true, force: true })
  process.exit(1)
}

const [west, south, east, north] = frames[0].bbox
writeFileSync(OUT + '/manifest.json', JSON.stringify({
  run: runIso,
  generatedAt: new Date().toISOString(),
  model: 'aromepi-001-pt15m',
  bounds: [[south, west], [north, east]],
  frames: frames.map(({ time, file, maxMm }) => ({ time, file, maxMm })),
}))
console.log('run ' + runIso + ' : ' + frames.length + ' frames pretes dans ' + OUT + '/')
