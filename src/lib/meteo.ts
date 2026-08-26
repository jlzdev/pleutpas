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

export const SLOT_MIN = 15
export const WET_MM = 0.1
export const STALE_MS = 60 * 60 * 1000
export const BESANCON: Place = { name: 'Besançon', lat: 47.238, lon: 6.024 }

export function fmtHM(t: number | Date): string {
  return new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function slotIndexNow(slots: Slot[], nowMs: number): number {
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].start + SLOT_MIN * 60000 > nowMs) return i
  }
  return -1
}

export function wetAtMs(slots: Slot[], mf: MfEntry[] | null, tMs: number): boolean {
  if (mf) {
    for (const e of mf) {
      if (tMs >= e.start && tMs < e.end) return e.level >= 2
    }
  }
  if (!slots.length) return false
  const i = Math.floor((tMs - slots[0].start) / (SLOT_MIN * 60000))
  if (i >= 0 && i < slots.length) return slots[i].mm >= WET_MM
  return false
}

export function isDryWindowMs(slots: Slot[], mf: MfEntry[] | null, startMs: number, durMin: number): boolean {
  const endMs = startMs + durMin * 60000
  for (let t = startMs; t < endMs; t += 5 * 60000) {
    if (wetAtMs(slots, mf, t)) return false
  }
  return !wetAtMs(slots, mf, endMs - 1)
}

export function next5min(t: number): number {
  return t % 300000 === 0 ? t + 300000 : Math.ceil(t / 300000) * 300000
}

export function firstWetMs(slots: Slot[], mf: MfEntry[] | null, fromMs: number): number {
  const endMs = fromMs + 48 * 3600000
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    if (wetAtMs(slots, mf, t)) return t
  }
  return -1
}

export function nextDryDepartureMs(slots: Slot[], mf: MfEntry[] | null, fromMs: number, durMin: number): number {
  const endMs = fromMs + 48 * 3600000
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    if (isDryWindowMs(slots, mf, t, durMin)) return t
  }
  return -1
}

export function intensityColor(mm15: number): string | null {
  if (mm15 < WET_MM) return null
  if (mm15 < 0.25) return 'var(--color-bruine)'
  if (mm15 < 0.75) return 'var(--color-legere)'
  if (mm15 < 2) return 'var(--color-modere)'
  if (mm15 < 5) return 'var(--color-fort)'
  if (mm15 < 12) return 'var(--color-tresfort)'
  return 'var(--color-grele)'
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
  const forecastDry = isDryWindowMs(slots, mf, nowMs, tripMin)
  const dry = forecastDry && radarWetNow !== true
  if (dry) {
    const wetT = firstWetMs(slots, mf, nowMs)
    return {
      state: 'oui',
      big: 'OUI',
      sub: 'Prends ton vélo',
      detail: wetT < 0
        ? 'Pas de pluie prévue sur les prochaines 48 h.'
        : 'Sec jusqu\'à ' + fmtHM(wetT) + ' environ.',
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
  const rainingNow = wetAtMs(slots, mf, nowMs) || radarWetNow === true
  const wetT = firstWetMs(slots, mf, nowMs)
  const sub = rainingNow ? 'Il pleut en ce moment' : 'Pluie prévue vers ' + fmtHM(wetT)
  const depMs = nextDryDepartureMs(slots, mf, nowMs, tripMin)
  if (depMs < 0) {
    return { state: 'non', big: 'NON', sub, detail: 'Pas de fenêtre sèche trouvée sur les prochaines 48 h.' }
  }
  const depDate = new Date(Math.max(depMs, nowMs))
  const demain = depDate.getDate() !== new Date(nowMs).getDate() ? ' demain' : ''
  return {
    state: 'non',
    big: 'NON',
    sub,
    detail: 'Prochain départ au sec : ' + fmtHM(depDate) + demain,
  }
}
