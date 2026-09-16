import palette from './palette.json'

export interface Place {
  name: string
  lat: number
  lon: number
}

export interface Slot {
  start: number
  mm: number
}

export interface MfEntry {
  start: number
  end: number
  level: number
  desc: string
}

export interface VerdictView {
  state: 'oui' | 'bof' | 'non' | 'inconnu'
  big: string
  sub: string
  detail: string
}

export const SLOT_MIN = palette.slotMin
export const WET_MM = palette.wetMm
export const LIGHT_MAX_MM = palette.lightMaxMm
export const BESANCON: Place = { name: 'Besançon', lat: 47.238, lon: 6.024 }
// bbox des frames Meteo-France (France metro et abords immediats), limite de la recherche,
// de la geolocalisation et du deplacement de la carte
export const FRANCE_BOUNDS: [[number, number], [number, number]] = [[41, -5.5], [51.5, 10]]

export function inFranceBounds(lat: number, lon: number): boolean {
  const [[south, west], [north, east]] = FRANCE_BOUNDS
  return lat >= south && lat <= north && lon >= west && lon <= east
}

const STALE_MS = 60 * 60 * 1000
export const STEP_5MIN_MS = 5 * 60 * 1000
const LEGERE_MM = palette.steps.find((s) => s.name === 'legere')?.mm ?? LIGHT_MAX_MM

// forme francaise collee ("4h15", "23h"), le format 4:15 est un anglicisme
export function fmtHM(t: number | Date): string {
  const d = new Date(t)
  const m = d.getMinutes()
  return d.getHours() + 'h' + (m ? String(m).padStart(2, '0') : '')
}

export function fmtDay(tMs: number, nowMs: number): string {
  const t = new Date(tMs)
  const n = new Date(nowMs)
  const days = Math.round(
    (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
      - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000,
  )
  if (days <= 0) return ''
  if (days === 1) return 'demain'
  return t.toLocaleDateString('fr-FR', { weekday: 'long' })
}

function fmtDayHM(tMs: number, nowMs: number): string {
  const d = fmtDay(tMs, nowMs)
  return d ? d + ' ' + fmtHM(tMs) : fmtHM(tMs)
}

export function slotIndexNow(slots: Slot[], nowMs: number): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].start + SLOT_MIN * 60000 > nowMs) return i
  }
  return -1
}

function slotsEndMs(slots: Slot[]): number {
  return slots.length ? slots[slots.length - 1].start + SLOT_MIN * 60000 : 0
}

function mfEntryAt(mf: MfEntry[] | null, tMs: number): MfEntry | null {
  if (!mf) return null
  for (const e of mf) {
    if (tMs >= e.start && tMs < e.end) return e
  }
  return null
}

function slotAt(slots: Slot[], tMs: number): Slot | null {
  if (!slots.length) return null
  const i = Math.floor((tMs - slots[0].start) / (SLOT_MIN * 60000))
  return i >= 0 && i < slots.length ? slots[i] : null
}

// niveaux MF pluie dans l'heure (1 sec, 2 faible, 3 moderee, 4 forte) ramenes a l'echelle
// mm / 15 min de la palette, seule unite du verdict et de la timeline
export function mfLevelMm(level: number): number {
  const table = palette.mfLevelMm
  return table[Math.max(0, Math.min(level, table.length - 1))]
}

function mmAtMs(slots: Slot[], mf: MfEntry[] | null, tMs: number): number | null {
  const e = mfEntryAt(mf, tMs)
  if (e) return mfLevelMm(e.level)
  const s = slotAt(slots, tMs)
  return s ? s.mm : null
}

function wetAtMs(slots: Slot[], mf: MfEntry[] | null, tMs: number): boolean | null {
  const mm = mmAtMs(slots, mf, tMs)
  return mm === null ? null : mm >= WET_MM
}

function maxMmWindow(slots: Slot[], mf: MfEntry[] | null, startMs: number, durMin: number): number | null {
  const endMs = startMs + durMin * 60000
  let max = 0
  for (let t = startMs; t < endMs; t += STEP_5MIN_MS) {
    const mm = mmAtMs(slots, mf, t)
    if (mm === null) return null
    max = Math.max(max, mm)
  }
  const last = mmAtMs(slots, mf, endMs - 1)
  return last === null ? null : Math.max(max, last)
}

function isDryWindowMs(slots: Slot[], mf: MfEntry[] | null, startMs: number, durMin: number): boolean {
  const mm = maxMmWindow(slots, mf, startMs, durMin)
  return mm !== null && mm < WET_MM
}

function next5min(t: number): number {
  return (Math.floor(t / STEP_5MIN_MS) + 1) * STEP_5MIN_MS
}

function firstWetMs(slots: Slot[], mf: MfEntry[] | null, fromMs: number): number {
  const endMs = Math.min(fromMs + 48 * 3600000, slotsEndMs(slots))
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    if (wetAtMs(slots, mf, t) === true) return t
  }
  return -1
}

function nextDryDepartureMs(slots: Slot[], mf: MfEntry[] | null, fromMs: number, durMin: number): number {
  const endMs = Math.min(fromMs + 48 * 3600000, slotsEndMs(slots))
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    if (isDryWindowMs(slots, mf, t, durMin)) return t
  }
  return -1
}

export function intensityColor(mm15: number): string | null {
  let name: string | null = null
  for (const s of palette.steps) {
    if (mm15 >= s.mm) name = s.name
  }
  return name ? 'var(--color-' + name + ')' : null
}

function lightWord(mm15: number): string {
  return mm15 < LEGERE_MM ? 'Bruine' : 'Pluie faible'
}

export interface TimelineCell {
  start: number
  wet: boolean
  color: string | null
  title: string
}

// vue unique des 2 prochaines heures en cases de 5 min, memes sources et meme priorite
// que le verdict (MF pluie dans l'heure d'abord, Open-Meteo au-dela), pour que la carte
// timeline ne puisse jamais contredire le OUI/NON
export function timelineCells(slots: Slot[], mf: MfEntry[] | null, nowMs: number): TimelineCell[] {
  const firstMs = Math.floor(nowMs / STEP_5MIN_MS) * STEP_5MIN_MS
  const cells: TimelineCell[] = []
  for (let i = 0; i < 24; i++) {
    const t = firstMs + i * STEP_5MIN_MS
    const e = mfEntryAt(mf, t)
    if (e) {
      const mm = mfLevelMm(e.level)
      cells.push({ start: t, wet: mm >= WET_MM, color: intensityColor(mm), title: fmtHM(t) + ' : ' + e.desc })
      continue
    }
    const s = slotAt(slots, t)
    if (!s) break
    cells.push({
      start: t,
      wet: s.mm >= WET_MM,
      color: intensityColor(s.mm),
      title: fmtHM(t) + ' : ' + s.mm.toFixed(1) + ' mm / 15 min',
    })
  }
  return cells
}

export interface DayCell {
  start: number
  mm: number
  wetAt: number | null
}

// prend le relais de la timeline 2 h : cumuls horaires recalcules depuis la meme serie
// minutely_15 que lit le verdict au-dela de l'heure MF, coherence par construction
export function dayCells(slots: Slot[], nowMs: number): DayCell[] {
  const bandEndMs = Math.floor(nowMs / STEP_5MIN_MS) * STEP_5MIN_MS + 24 * STEP_5MIN_MS
  const firstHourMs = Math.floor(bandEndMs / 3600000) * 3600000
  const cells: DayCell[] = []
  for (let i = 0; i < 24; i++) {
    const h0 = firstHourMs + i * 3600000
    let mm = 0
    let wetAt: number | null = null
    let filled = 0
    for (let t = h0; t < h0 + 3600000; t += SLOT_MIN * 60000) {
      const s = slotAt(slots, t)
      if (!s) break
      filled++
      mm += s.mm
      if (wetAt === null && s.mm >= WET_MM) wetAt = s.start
    }
    if (filled < 4) break
    cells.push({ start: h0, mm, wetAt })
  }
  return cells
}

export function computeVerdict(
  slots: Slot[],
  mf: MfEntry[] | null,
  radarMmNow: number | null,
  tripMin: number,
  nowMs: number,
  fetchedAtMs: number | null,
): VerdictView {
  const stale = fetchedAtMs !== null && nowMs - fetchedAtMs > STALE_MS
  const idx = slotIndexNow(slots, nowMs)
  if (idx < 0 || stale) {
    return {
      state: 'inconnu',
      big: '?',
      sub: stale ? 'Données trop anciennes' : 'Pas de données',
      detail: 'Actualise quand tu as du réseau.',
    }
  }
  // MF pluie dans l'heure (radar controle qualite par Meteo-France) fait autorite sur le
  // "maintenant" : l'echantillonnage de la lame d'eau (frames PIAF passees) ne sert de
  // detecteur de pluie que quand MF ne repond pas.
  // Le premier pas MF demarre au prochain multiple de 5 min, d'ou la tolerance en amont
  const mfCoversNow = !!mf && mf.length > 0
    && nowMs >= mf[0].start - 2 * STEP_5MIN_MS && nowMs < mf[mf.length - 1].end
  const radarMm = mfCoversNow ? null : radarMmNow
  const tripMm = maxMmWindow(slots, mf, nowMs, tripMin)
  const worstMm = tripMm === null ? null : Math.max(tripMm, radarMm ?? 0)
  if (worstMm !== null && worstMm < WET_MM) {
    const wetT = firstWetMs(slots, mf, nowMs)
    return {
      state: 'oui',
      big: 'OUI',
      sub: 'Prends ton vélo',
      detail: wetT < 0
        ? 'Pas de pluie prévue jusqu\'à ' + fmtDayHM(slotsEndMs(slots), nowMs) + ' (fin des prévisions).'
        : 'Sec jusqu\'à ' + fmtDayHM(wetT, nowMs) + ' environ.',
    }
  }
  const nowMm = Math.max(mmAtMs(slots, mf, nowMs) ?? 0, radarMm ?? 0)
  const rainingNow = nowMm >= WET_MM
  const wetT = firstWetMs(slots, mf, nowMs)
  const depMs = nextDryDepartureMs(slots, mf, nowMs, tripMin)
  const noDryWindow = 'Pas de fenêtre sèche trouvée d\'ici ' + fmtDayHM(slotsEndMs(slots), nowMs) + ' (fin des prévisions).'
  // bruine ou pluie faible seulement sur le trajet : ca se roule avec une veste, le
  // NON est reserve a la vraie pluie
  const radarOnly = tripMm !== null && tripMm < WET_MM
  const unforeseen = 'Averse non prévue, reviens voir quand elle passe.'
  if (worstMm !== null && worstMm < LIGHT_MAX_MM) {
    const word = lightWord(rainingNow ? nowMm : worstMm)
    return {
      state: 'bof',
      big: 'OUI',
      sub: rainingNow || wetT < 0
        ? word + ' en ce moment, sors la veste'
        : word + ' prévue vers ' + fmtDayHM(wetT, nowMs) + ', sors la veste',
      detail: radarOnly ? unforeseen
        : depMs < 0 ? noDryWindow : 'Sinon, prochain départ au sec : ' + fmtDayHM(depMs, nowMs) + '.',
    }
  }
  if (radarOnly) {
    return {
      state: 'non',
      big: 'NON',
      sub: 'Il pleut en ce moment (vu au radar)',
      detail: unforeseen,
    }
  }
  const sub = rainingNow || wetT < 0 ? 'Il pleut en ce moment' : 'Pluie prévue vers ' + fmtDayHM(wetT, nowMs)
  if (depMs < 0) {
    return { state: 'non', big: 'NON', sub, detail: noDryWindow }
  }
  return {
    state: 'non',
    big: 'NON',
    sub,
    detail: 'Prochain départ au sec : ' + fmtDayHM(depMs, nowMs),
  }
}
