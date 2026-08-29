import { mkdirSync, rmSync } from 'node:fs'
import { bail, buildRun, catalogRuns, resolvePrevRun, writeManifest } from './frames-lib.mjs'

const API = 'https://public-api.meteofrance.fr/public/aromepi/1.0/wcs/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WCS'
const MANIFEST_URL = 'https://raw.githubusercontent.com/jlzdev/pleutpas/data/manifest.json'
const SUBSET = '&subset=lat(41,51.5)&subset=long(-5.5,10)&format=image/tiff'
const OUT = 'out'
// la meme donnee est indexee sous deux dialectes d'identifiants selon le backend qui repond
const FAMILIES = ['PRECIP__GROUND', 'TOTAL_PRECIPITATION__GROUND_OR_WATER_SURFACE']
// un nouveau run AROME-PI sort toutes les heures, disponible ~30 min apres H :
// au-dela de 3 h sans publication, vraie panne
const MAX_AGE_MS = 180 * 60000

const key = process.env.MF_API_KEY
if (!key) {
  console.error('MF_API_KEY manquant')
  process.exit(1)
}

const prevRun = await resolvePrevRun(MANIFEST_URL)
const giveUp = (msg) => {
  rmSync(OUT, { recursive: true, force: true })
  bail(prevRun, MAX_AGE_MS, msg)
}

const runRe = new RegExp('(' + FAMILIES.join('|') + ')___(?<run>\\d{4}-\\d{2}-\\d{2}T\\d{2}\\.\\d{2}\\.\\d{2}Z)_PT15M', 'g')
const { found, runs } = await catalogRuns(key, API, runRe, giveUp)

// MF annonce un run dans le catalogue avant d'avoir fini de charger ses echeances (404 pendant ~30 min),
// d'ou le repli sur le run precedent quand le plus recent est incomplet
for (const runId of runs) {
  const runIso = runId.replaceAll('.', ':')
  if (prevRun === runIso) giveUp('rien de neuf, run ' + runIso + ' deja publie')
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT + '/frames', { recursive: true })
  const family = found.find((m) => m.groups.run === runId)[1]
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

giveUp('aucun run complet parmi ' + runs.map((r) => r.replaceAll('.', ':')).join(', ') + ', publication annulee')
