import { mkdirSync, rmSync } from 'node:fs'
import { buildRun, mfXml, resolvePrevRun, writeManifest } from './frames-lib.mjs'

const API = 'https://api.meteofrance.fr/pro/piaf/1.0/wcs/MF-NWP-HIGHRES-PIAF-001-FRANCE-WCS'
const MANIFEST_URL = 'https://raw.githubusercontent.com/jlzdev/pleutpas/piaf/manifest.json'
const SUBSET = '&subset=lat(41,51.5)&subset=long(-5.5,10)&format=image/tiff'
const OUT = 'out-piaf'
const FAMILY = 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE'
const STEPS = 39
const MIN_FRAMES = 20
// PIAF livre des cumuls sur 5 min : x3 pour retrouver l'echelle d'intensite mm/15 min de la palette
// partagee avec l'app ; grille native 0.01 deg reduite de moitie pour le poids des PNG
const MM_SCALE = 3
const SHRINK = 2

const key = process.env.MF_API_KEY
if (!key) {
  console.error('MF_API_KEY manquant')
  process.exit(1)
}

const caps = await mfXml(key, API + '/GetCapabilities?service=WCS&version=2.0.1&language=eng')
const runRe = new RegExp(FAMILY + '___(\\d{4}-\\d{2}-\\d{2}T\\d{2}\\.\\d{2}\\.\\d{2}Z)_PT5M', 'g')
const found = [...caps.matchAll(runRe)]
if (!found.length) {
  console.error('aucun run PT5M dans le GetCapabilities')
  process.exit(1)
}
const runs = [...new Set(found.map((m) => m[1]))].sort().reverse().slice(0, 3)

const prevRun = await resolvePrevRun(MANIFEST_URL)

for (const runId of runs) {
  const runIso = runId.replaceAll('.', ':')
  if (prevRun === runIso) {
    console.log('rien de neuf, run ' + runIso + ' deja publie')
    process.exit(0)
  }
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT + '/frames', { recursive: true })
  const runMs = Date.parse(runIso)
  const steps = Array.from({ length: STEPS }, (_, k) => runMs + (k + 1) * 300000)
  const frames = await buildRun(
    { key, api: API, subset: SUBSET, outDir: OUT, mmScale: MM_SCALE, shrink: SHRINK },
    FAMILY + '___' + runId + '_PT5M', steps, MIN_FRAMES,
  )
  if (frames.length < MIN_FRAMES) {
    console.error('run ' + runIso + ' incomplet (' + frames.length + '/' + STEPS + ' frames), repli sur le run precedent')
    continue
  }
  writeManifest(OUT, 'piaf-001-pt5m', runIso, frames)
  console.log('run ' + runIso + ' : ' + frames.length + ' frames pretes dans ' + OUT + '/')
  process.exit(0)
}

rmSync(OUT, { recursive: true, force: true })
console.error('aucun run complet parmi ' + runs.map((r) => r.replaceAll('.', ':')).join(', ') + ', publication annulee')
process.exit(1)
