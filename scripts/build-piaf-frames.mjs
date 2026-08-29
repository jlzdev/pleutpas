import { mkdirSync, rmSync } from 'node:fs'
import { bail, buildFrame, buildRun, catalogRuns, resolvePrevRun, writeManifest } from './frames-lib.mjs'

const API = 'https://api.meteofrance.fr/pro/piaf/1.0/wcs/MF-NWP-HIGHRES-PIAF-001-FRANCE-WCS'
const MANIFEST_URL = 'https://raw.githubusercontent.com/jlzdev/pleutpas/piaf/manifest.json'
const SUBSET = '&subset=lat(41,51.5)&subset=long(-5.5,10)&format=image/tiff'
const OUT = 'out-piaf'
const FAMILY = 'TOTAL_PRECIPITATION_RATE__GROUND_OR_WATER_SURFACE'
const STEPS = 39
const MIN_FRAMES = 20
const PAST_COUNT = 24
// PIAF livre des cumuls sur 5 min : x3 pour retrouver l'echelle d'intensite mm/15 min de la palette
// partagee avec l'app ; grille native 0.01 deg reduite de moitie pour le poids des PNG
const MM_SCALE = 3
const SHRINK = 2
// un nouveau run PIAF sort toutes les 5 min : au-dela de 45 min sans publication, vraie panne
const MAX_AGE_MS = 45 * 60000

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

const runRe = new RegExp(FAMILY + '___(?<run>\\d{4}-\\d{2}-\\d{2}T\\d{2}\\.\\d{2}\\.\\d{2}Z)_PT5M', 'g')
const { all: allRuns, runs } = await catalogRuns(key, API, runRe, giveUp)

const cfg = { key, api: API, subset: SUBSET, outDir: OUT, mmScale: MM_SCALE, shrink: SHRINK }

let chosen = null
for (const runId of runs) {
  const runIso = runId.replaceAll('.', ':')
  if (prevRun === runIso) giveUp('rien de neuf, run ' + runIso + ' deja publie')
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT + '/frames', { recursive: true })
  const runMs = Date.parse(runIso)
  const steps = Array.from({ length: STEPS }, (_, k) => runMs + (k + 1) * 300000)
  const frames = await buildRun(cfg, FAMILY + '___' + runId + '_PT5M', steps, MIN_FRAMES)
  if (frames.length < MIN_FRAMES) {
    console.error('run ' + runIso + ' incomplet (' + frames.length + '/' + STEPS + ' frames), repli sur le run precedent')
    continue
  }
  chosen = { runIso, runMs, frames }
  break
}

if (!chosen) giveUp('aucun run complet parmi ' + runs.map((r) => r.replaceAll('.', ':')).join(', ') + ', publication annulee')

// le passe est reconstruit sans etat : la lame d'eau quasi observee de l'instant T est
// l'echeance +5 min du run T-5, encore present au catalogue (meme palette que le futur)
const srcRunId = (tMs) => new Date(tMs - 300000).toISOString().replace('.000', '').replaceAll(':', '.')
const instants = Array.from({ length: PAST_COUNT }, (_, k) => chosen.runMs - k * 300000)
  .filter((t) => allRuns.has(srcRunId(t)))
const past = []
let nextPast = 0
await Promise.all(Array.from({ length: 4 }, async () => {
  while (nextPast < instants.length) {
    const t = instants[nextPast++]
    try {
      past.push(await buildFrame(cfg, FAMILY + '___' + srcRunId(t) + '_PT5M', t))
    } catch (e) {
      console.error('passe ' + new Date(t).toISOString() + ' abandonne : ' + e.message)
    }
  }
}))
past.sort((a, b) => a.time - b.time)

writeManifest(OUT, 'piaf-001-pt5m', chosen.runIso, chosen.frames, past)
console.log('run ' + chosen.runIso + ' : ' + chosen.frames.length + ' frames futures + '
  + past.length + ' frames passees pretes dans ' + OUT + '/')
