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

const STALE_MS = 60 * 60 * 1000
const STEP_5MIN_MS = 5 * 60 * 1000

export function fmtHM(t: number | Date): string {
  return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function fmtDayHM(tMs: number, nowMs: number): string {
  const t = new Date(tMs)
  const n = new Date(nowMs)
  const days = Math.round(
    (new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
      - new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime()) / 86400000,
  )
  if (days <= 0) return fmtHM(tMs)
  if (days === 1) return 'demain ' + fmtHM(tMs)
  return t.toLocaleDateString('fr-FR', { weekday: 'long' }) + ' ' + fmtHM(tMs)
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

function wetAtMs(slots: Slot[], mf: MfEntry[] | null, tMs: number): boolean | null {
  if (mf) {
    for (const e of mf) {
      if (tMs >= e.start && tMs < e.end) return e.level >= MF_WET_LEVEL
    }
  }
  if (!slots.length) return null
  const i = Math.floor((tMs - slots[0].start) / (SLOT_MIN * 60000))
  if (i >= 0 && i < slots.length) return slots[i].mm >= WET_MM
  return null
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
  // "maintenant" : l'echo RainViewer ne sert de detecteur de pluie que quand MF ne repond pas.
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
