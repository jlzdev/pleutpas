import { mkdirSync, rmSync } from 'node:fs'
import { buildRun, mfXml, resolvePrevRun, writeManifest } from './frames-lib.mjs'

const API = 'https://public-api.meteofrance.fr/public/aromepi/1.0/wcs/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WCS'
const MANIFEST_URL = 'https://raw.githubusercontent.com/jlzdev/pleutpas/data/manifest.json'
const SUBSET = '&subset=lat(41,51.5)&subset=long(-5.5,10)&format=image/tiff'
const OUT = 'out'
// la meme donnee est indexee sous deux dialectes d'identifiants selon le backend qui repond
const FAMILIES = ['PRECIP__GROUND', 'TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE']

const key = process.env.MF_API_KEY
if (!key) {
  console.error('MF_API_KEY manquant')
  process.exit(1)
}

const caps = await mfXml(key, API + '/GetCapabilities?service=WCS&version=2.0.1&language=eng')
const runRe = new RegExp('(' + FAMILIES.join('|') + ')___(\\d{4}-\\d{2}-\\d{2}T\\d{2}\\.\\d{2}\\.\\d{2}Z)_PT15M', 'g')
const found = [...caps.matchAll(runRe)]
if (!found.length) {
  console.error('aucun run pluie PT15M dans le GetCapabilities')
  process.exit(1)
}
const runs = [...new Set(found.map((m) => m[2]))].sort().reverse().slice(0, 3)

const prevRun = await resolvePrevRun(MANIFEST_URL)

// MF annonce un run dans le catalogue avant d'avoir fini de charger ses echeances (404 pendant ~30 min),
// d'ou le repli sur le run precedent quand le plus recent est incomplet
for (const runId of runs) {
  const runIso = runId.replaceAll('.', ':')
  if (prevRun === runIso) {
    console.log('rien de neuf, run ' + runIso + ' deja publie')
    process.exit(0)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT + '/frames', { recursive: true })
  const family = found.find((m) => m[2] === runId)[1]
  const runMs = Date.parse(runIso)
  const steps = Array.from({ length: 24 }, (_, k) => runMs + (k + 1) * 900000)
  const frames = await buildRun({ key, api: API, subset: SUBSET, outDir: OUT }, family + '___' + runId + '_PT15M', steps, 12)
  if (frames.length < 12) {
    console.error('run ' + runIso + ' incomplet (' + frames.length + '/24 frames), repli sur le run precedent')
    continue
  }
  writeManifest(OUT, 'aromepi-001-pt15m', runIso, frames)
  console.log('run ' + runIso + ' : ' + frames.length + ' frames pretes dans ' + OUT + '/')
  process.exit(0)
}

rmSync(OUT, { recursive: true, force: true })
console.error('aucun run complet parmi ' + runs.map((r) => r.replaceAll('.', ':')).join(', ') + ', publication annulee')
process.exit(1)
