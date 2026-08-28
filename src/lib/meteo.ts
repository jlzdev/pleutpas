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
  state: 'oui' | 'non' | 'inconnu'
  big: string
  sub: string
  detail: string
}

export const SLOT_MIN = palette.slotMin
export const WET_MM = palette.wetMm
export const MF_WET_LEVEL = palette.mfWetLevel
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

function wetAtMs(slots: Slot[], mf: MfEntry[] | null, tMs: number): boolean | null {
  const e = mfEntryAt(mf, tMs)
  if (e) return e.level >= MF_WET_LEVEL
  const s = slotAt(slots, tMs)
  return s ? s.mm >= WET_MM : null
}

function isDryWindowMs(slots: Slot[], mf: MfEntry[] | null, startMs: number, durMin: number): boolean {
  const endMs = startMs + durMin * 60000
  for (let t = startMs; t < endMs; t += STEP_5MIN_MS) {
    if (wetAtMs(slots, mf, t) !== false) return false
  }
  return wetAtMs(slots, mf, endMs - 1) === false
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

export function mfLevelColor(level: number): string {
  if (level < MF_WET_LEVEL) return 'var(--color-line)'
  const names: Record<number, string> = { 2: 'legere', 3: 'modere', 4: 'fort' }
  return 'var(--color-' + (names[level] ?? 'tresfort') + ')'
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
      const wet = e.level >= MF_WET_LEVEL
      cells.push({ start: t, wet, color: wet ? mfLevelColor(e.level) : null, title: fmtHM(t) + ' : ' + e.desc })
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
  radarWetNow: boolean | null,
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
  const radarNow = mfCoversNow ? null : radarWetNow
  const forecastDry = isDryWindowMs(slots, mf, nowMs, tripMin)
  const dry = forecastDry && radarNow !== true
  if (dry) {
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
  if (forecastDry) {
    return {
      state: 'non',
      big: 'NON',
      sub: 'Il pleut en ce moment (vu au radar)',
      detail: 'Averse non prévue, reviens voir quand elle passe.',
    }
  }
  const rainingNow = wetAtMs(slots, mf, nowMs) === true || radarNow === true
  const wetT = firstWetMs(slots, mf, nowMs)
  const sub = rainingNow || wetT < 0 ? 'Il pleut en ce moment' : 'Pluie prévue vers ' + fmtDayHM(wetT, nowMs)
  const depMs = nextDryDepartureMs(slots, mf, nowMs, tripMin)
  if (depMs < 0) {
    return {
      state: 'non',
      big: 'NON',
      sub,
      detail: 'Pas de fenêtre sèche trouvée d\'ici ' + fmtDayHM(slotsEndMs(slots), nowMs) + ' (fin des prévisions).',
    }
  }
  return {
    state: 'non',
    big: 'NON',
    sub,
    detail: 'Prochain départ au sec : ' + fmtDayHM(depMs, nowMs),
  }
}
