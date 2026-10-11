import { ref } from 'vue'
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
  state: 'oui' | 'bof' | 'pluie' | 'inconnu'
  big: string
  sub: string
  detail: string
}

export interface ConditionSeries {
  time: number[]
  temperature_2m?: (number | null)[]
  apparent_temperature?: (number | null)[]
  wind_speed_10m?: (number | null)[]
  wind_direction_10m?: (number | null)[]
  wind_gusts_10m?: (number | null)[]
}

export interface Conditions {
  tempC: number
  feelsC: number
  windKmh: number
  windFrom: number
  gustKmh: number
}

export interface ConditionsText {
  temp: string
  wind: string
  strong: boolean
}

export interface FrameSample {
  time: number
  past: boolean
  mm: (number | null)[]
}

export interface Trip {
  positions: Place[]
  hasDest: boolean
  mf: [MfEntry[] | null, MfEntry[] | null]
  slots: [Slot[], Slot[]]
  samples: FrameSample[] | null
}

export const TRIP_POSITIONS = 25
export const TRIP_SPEED_KMH = 15
export const MAX_TRIP_MIN = 120
export const MIN_TRIP_MIN = 5

export function estimatedTripMin(a: Place, b: Place): number {
  return Math.round((distanceKm(a, b) / TRIP_SPEED_KMH) * 60 / 5) * 5
}

export function tripPositions(a: Place, b: Place | null): Place[] {
  if (!b) return [a]
  const out: Place[] = []
  for (let i = 0; i < TRIP_POSITIONS; i++) {
    const f = i / (TRIP_POSITIONS - 1)
    out.push({ name: '', lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f })
  }
  return out
}

export function distanceKm(a: Place, b: Place): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export function bearingDeg(a: Place, b: Place): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLon = toRad(b.lon - a.lon)
  const y = Math.sin(dLon) * Math.cos(toRad(b.lat))
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export const SLOT_MIN = palette.slotMin
export const WET_MM = palette.wetMm
export const LIGHT_MAX_MM = palette.lightMaxMm
export const BESANCON: Place = { name: 'Besançon', lat: 47.238, lon: 6.024 }
// bbox des frames Meteo-France (France metro et abords immediats), limite de la recherche,
// de la geolocalisation et du deplacement de la carte
export const FRANCE_BOUNDS: [[number, number], [number, number]] = [[41, -5.5], [51.5, 10]]

// convention des libelles d'adresse : "Rue, Commune"
export function placeTown(p: Place): string {
  const i = p.name.lastIndexOf(', ')
  return i > 0 ? p.name.slice(i + 2) : p.name
}

function placeStreet(p: Place): string {
  const town = placeTown(p)
  return p.name.endsWith(', ' + town) ? p.name.slice(0, -(town.length + 2)) : p.name
}

export function routeLabels(a: Place, b: Place | null): [string, string | null] {
  if (!b) return [placeTown(a), null]
  const same = placeTown(a) === placeTown(b)
  return same ? [placeStreet(a), placeStreet(b)] : [placeTown(a), placeTown(b)]
}

export function routeLabel(a: Place, b: Place | null): string {
  const [x, y] = routeLabels(a, b)
  return y ? x + ' vers ' + y : x
}

export function cleanName(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60)
}

export function inFranceBounds(lat: number, lon: number): boolean {
  const [[south, west], [north, east]] = FRANCE_BOUNDS
  return lat >= south && lat <= north && lon >= west && lon <= east
}

const STALE_MS = 60 * 60 * 1000
export const STEP_5MIN_MS = 5 * 60 * 1000
const LEGERE_MM = palette.steps.find((s) => s.name === 'legere')?.mm ?? LIGHT_MAX_MM

// fuseau du lieu consulte (fourni par Open-Meteo), undefined = celui de l'appareil ;
// les heures affichees sont celles du lieu, comme sur toute app meteo
export const displayZone = ref<string | undefined>(undefined)
export const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const clockFormats = new Map<string, Intl.DateTimeFormat>()

function clockFormat(): Intl.DateTimeFormat {
  const key = displayZone.value ?? ''
  let f = clockFormats.get(key)
  if (!f) {
    const opts: Intl.DateTimeFormatOptions = {
      hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'long',
    }
    try {
      f = new Intl.DateTimeFormat('fr-FR', { ...opts, timeZone: displayZone.value })
    } catch {
      f = new Intl.DateTimeFormat('fr-FR', opts)
    }
    clockFormats.set(key, f)
  }
  return f
}

export interface ClockParts {
  year: number
  month: number
  day: number
  h: number
  m: number
  weekday: string
}

export function clockParts(t: number | Date): ClockParts {
  const out: Record<string, string> = {}
  for (const p of clockFormat().formatToParts(new Date(t))) out[p.type] = p.value
  return {
    year: Number(out.year), month: Number(out.month), day: Number(out.day),
    h: Number(out.hour), m: Number(out.minute), weekday: out.weekday,
  }
}

export function fmtMinutes(min: number): string {
  if (min < 60) return min + ' min'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? h + ' h ' + String(m).padStart(2, '0') : h + ' h'
}

// forme francaise collee ("4h15", "23h"), le format 4:15 est un anglicisme
export function fmtHM(t: number | Date): string {
  const { h, m } = clockParts(t)
  return h + 'h' + (m ? String(m).padStart(2, '0') : '')
}

export function fmtDay(tMs: number, nowMs: number): string {
  const t = clockParts(tMs)
  const n = clockParts(nowMs)
  const days = Math.round((Date.UTC(t.year, t.month - 1, t.day) - Date.UTC(n.year, n.month - 1, n.day)) / 86400000)
  if (days <= 0) return ''
  if (days === 1) return 'demain'
  return t.weekday
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

const FEELS_DIFF_C = 2
const CALM_KMH = 10
const GUST_MIN_KMH = 35
const GUST_RATIO = 1.5
const STRONG_GUST_KMH = 50
const WIND_FROM = ['du nord', 'de nord-est', "d'est", 'de sud-est', 'du sud', 'de sud-ouest', "d'ouest", 'de nord-ouest']

export function conditionsAt(series: ConditionSeries, nowMs: number): Conditions | null {
  const t = series.time
  let i = -1
  for (let k = 0; k < t.length; k++) {
    if (t[k] * 1000 + SLOT_MIN * 60000 > nowMs) { i = k; break }
  }
  if (i < 0) return null
  const tempC = series.temperature_2m?.[i]
  const feelsC = series.apparent_temperature?.[i]
  const windKmh = series.wind_speed_10m?.[i]
  const windFrom = series.wind_direction_10m?.[i]
  const gustKmh = series.wind_gusts_10m?.[i]
  if (tempC == null || feelsC == null || windKmh == null || windFrom == null || gustKmh == null) return null
  return { tempC, feelsC, windKmh, windFrom, gustKmh }
}

export function windWord(deg: number): string {
  const i = Math.round((((deg % 360) + 360) % 360) / 45) % 8
  return WIND_FROM[i]
}

function round5(v: number): number {
  return Math.round(v / 5) * 5
}

function fmtTempC(v: number): string {
  return Math.round(v) + ' °C'
}

export function relativeWindWord(windFrom: number, headingDeg: number): string {
  const apart = Math.abs((((windFrom - headingDeg) % 360) + 540) % 360 - 180)
  if (apart <= 45) return 'de face'
  if (apart >= 135) return 'de dos'
  return 'de travers'
}

export function fmtConditions(c: Conditions, headingDeg: number | null = null): ConditionsText {
  const feels = Math.abs(c.feelsC - c.tempC) >= FEELS_DIFF_C ? ', ressenti ' + fmtTempC(c.feelsC) : ''
  const temp = fmtTempC(c.tempC) + feels + '.'
  const wind = round5(c.windKmh)
  const gust = round5(c.gustKmh)
  const strong = c.gustKmh >= STRONG_GUST_KMH
  const gusts = c.gustKmh >= GUST_MIN_KMH && c.gustKmh >= GUST_RATIO * c.windKmh ? ', rafales ' + gust : ''
  if (wind < CALM_KMH && !gusts) return { temp, wind: 'Vent calme.', strong: false }
  const head = strong ? 'Vent fort ' : 'Vent '
  const from = headingDeg === null ? windWord(c.windFrom) : relativeWindWord(c.windFrom, headingDeg)
  return { temp, wind: head + from + ' ' + Math.max(wind, CALM_KMH) + ' km/h' + gusts + '.', strong }
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

const FRAME_TOL_MS = 7.5 * 60000

function sampleNear(samples: FrameSample[] | null, tMs: number): FrameSample | null {
  if (!samples || !samples.length) return null
  let lo = 0
  let hi = samples.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].time < tMs) lo = mid + 1
    else hi = mid
  }
  let best = samples[lo]
  if (lo > 0 && Math.abs(samples[lo - 1].time - tMs) < Math.abs(best.time - tMs)) best = samples[lo - 1]
  return Math.abs(best.time - tMs) <= FRAME_TOL_MS ? best : null
}

function posIndex(trip: Trip, k: number, n: number): number {
  const last = trip.positions.length - 1
  return last === 0 || n === 0 ? 0 : Math.round((k / n) * last)
}

function endOf(trip: Trip, pos: number): 0 | 1 | null {
  const last = trip.positions.length - 1
  if (pos === 0) return 0
  if (pos === last) return 1
  return null
}

function mmAtTrip(trip: Trip, pos: number, tMs: number): number | null {
  const end = endOf(trip, pos)
  if (end !== null) return mmAtMs(trip.slots[end], trip.mf[end], tMs)
  const f = sampleNear(trip.samples, tMs)
  const mm = f ? f.mm[pos] : null
  if (mm !== null && mm !== undefined) return mm
  const near = pos * 2 < trip.positions.length - 1 ? 0 : 1
  const s = slotAt(trip.slots[near], tMs)
  return s ? s.mm : null
}

export interface WindowMax {
  mm: number
  pos: number
  time: number
}

function maxMmWindow(trip: Trip, startMs: number, durMin: number): WindowMax | null {
  const n = Math.max(1, Math.round(durMin / 5))
  const endMs = startMs + durMin * 60000
  let best: WindowMax | null = null
  for (let k = 0; k <= n; k++) {
    const t = k < n ? startMs + k * STEP_5MIN_MS : endMs - 1
    const pos = posIndex(trip, k, n)
    const mm = mmAtTrip(trip, pos, t)
    if (mm === null) return null
    if (!best || mm > best.mm) best = { mm, pos, time: k < n ? t : endMs }
  }
  return best
}

function isDryWindowMs(trip: Trip, startMs: number, durMin: number): boolean {
  const w = maxMmWindow(trip, startMs, durMin)
  return w !== null && w.mm < WET_MM
}

function next5min(t: number): number {
  return (Math.floor(t / STEP_5MIN_MS) + 1) * STEP_5MIN_MS
}

function endsEndMs(trip: Trip): number {
  return Math.max(slotsEndMs(trip.slots[0]), trip.hasDest ? slotsEndMs(trip.slots[1]) : 0)
}

function firstWetMs(trip: Trip, fromMs: number): number {
  const endMs = Math.min(fromMs + 48 * 3600000, endsEndMs(trip))
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    const a = mmAtMs(trip.slots[0], trip.mf[0], t)
    if (a !== null && a >= WET_MM) return t
    if (trip.hasDest) {
      const b = mmAtMs(trip.slots[1], trip.mf[1], t)
      if (b !== null && b >= WET_MM) return t
    }
  }
  return -1
}

function firstWetOnTrip(trip: Trip, fromMs: number, durMin: number): WindowMax | null {
  const n = Math.max(1, Math.round(durMin / 5))
  const endMs = fromMs + durMin * 60000
  const probes: number[] = []
  for (let t = fromMs; t < endMs; t = next5min(t)) probes.push(t)
  probes.push(endMs - 1)
  for (const t of probes) {
    const k = t === endMs - 1 ? n : Math.min(n, Math.round((t - fromMs) / STEP_5MIN_MS))
    const pos = posIndex(trip, k, n)
    const mm = mmAtTrip(trip, pos, t)
    if (mm !== null && mm >= WET_MM) return { mm, pos, time: k === n ? endMs : t }
  }
  return null
}

function nextWetDepartureMs(trip: Trip, fromMs: number, durMin: number): number {
  const endMs = Math.min(fromMs + 48 * 3600000, endsEndMs(trip))
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    const w = maxMmWindow(trip, t, durMin)
    if (w === null) return -1
    if (w.mm >= WET_MM) return t
  }
  return -1
}

function nextDryDepartureMs(trip: Trip, fromMs: number, durMin: number): number {
  const endMs = Math.min(fromMs + 48 * 3600000, endsEndMs(trip))
  for (let t = fromMs; t < endMs; t = next5min(t)) {
    if (isDryWindowMs(trip, t, durMin)) return t
  }
  return -1
}

// lame d'eau quasi observee au-dessus du depart : derniere frame passee, confirmee par la
// precedente (une pluie reelle persiste d'une image a l'autre, un parasite isole non)
export function radarNowMm(samples: FrameSample[] | null): number | null {
  if (!samples) return null
  const past = samples.filter((f) => f.past)
  const last = past[past.length - 1]
  if (!last) return null
  const mm = last.mm[0]
  if (mm === null || mm === undefined) return null
  const prev = past[past.length - 2]
  if (mm >= WET_MM && prev) {
    const confirm = prev.mm[0]
    if (confirm !== null && confirm !== undefined && confirm < WET_MM) return confirm
  }
  return mm
}

function whereWord(trip: Trip, pos: number): string {
  if (!trip.hasDest) return ''
  const end = endOf(trip, pos)
  return end === 0 ? ' au départ' : end === 1 ? ' à l\'arrivée' : ' en route'
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
export function timelineCells(trip: Trip, nowMs: number, tripMin: number): TimelineCell[] {
  const firstMs = Math.floor(nowMs / STEP_5MIN_MS) * STEP_5MIN_MS
  const cells: TimelineCell[] = []
  if (trip.hasDest) {
    for (let i = 0; i < 24; i++) {
      const t = firstMs + i * STEP_5MIN_MS
      const w = maxMmWindow(trip, i === 0 ? nowMs : t, tripMin)
      if (!w) break
      cells.push({
        start: t,
        wet: w.mm >= WET_MM,
        color: intensityColor(w.mm),
        title: 'Départ à ' + fmtHM(t) + ' : ' + w.mm.toFixed(1) + ' mm / 15 min au plus sur le trajet',
      })
    }
    return cells
  }
  const [slots, mf] = [trip.slots[0], trip.mf[0]]
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
  trip: Trip,
  tripMin: number,
  nowMs: number,
  fetchedAtMs: number | null,
): VerdictView {
  const stale = fetchedAtMs !== null && nowMs - fetchedAtMs > STALE_MS
  const idx = slotIndexNow(trip.slots[0], nowMs)
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
  const mf = trip.mf[0]
  const mfCoversNow = !!mf && mf.length > 0
    && nowMs >= mf[0].start - 2 * STEP_5MIN_MS && nowMs < mf[mf.length - 1].end
  const radarMm = mfCoversNow ? null : radarNowMm(trip.samples)
  const tripW = maxMmWindow(trip, nowMs, tripMin)
  if (tripW === null) {
    return {
      state: 'inconnu',
      big: '?',
      sub: 'Données incomplètes',
      detail: 'Il manque la prévision sur une partie du trajet, actualise dans un moment.',
    }
  }
  const tripMm = tripW.mm
  const worstMm = Math.max(tripMm, radarMm ?? 0)
  const firstWet = trip.hasDest ? nextWetDepartureMs(trip, nowMs, tripMin) : firstWetMs(trip, nowMs)
  if (worstMm < WET_MM) {
    return {
      state: 'oui',
      big: 'OUI',
      sub: 'Prends ton vélo',
      detail: firstWet < 0 ? '' : 'Sec jusqu\'à ' + fmtDayHM(firstWet, nowMs) + ' environ.',
    }
  }
  const nowMm = Math.max(mmAtTrip(trip, 0, nowMs) ?? 0, radarMm ?? 0)
  const rainingNow = nowMm >= WET_MM
  const wet = firstWetOnTrip(trip, nowMs, tripMin)
  const wetT = wet ? wet.time : firstWet
  const where = wet ? whereWord(trip, wet.pos) : ''
  const depMs = nextDryDepartureMs(trip, nowMs, tripMin)
  const noDryWindow = 'Pas de fenêtre sèche trouvée d\'ici ' + fmtDayHM(endsEndMs(trip), nowMs) + ' (fin des prévisions).'
  // bruine ou pluie faible seulement sur le trajet : ca se roule avec une veste, l'etat
  // PLUIE est reserve a la vraie pluie
  const radarOnly = tripMm < WET_MM
  const unforeseen = 'Averse non prévue, reviens voir quand elle passe.'
  if (worstMm < LIGHT_MAX_MM) {
    const word = lightWord(rainingNow ? nowMm : worstMm)
    return {
      state: 'bof',
      big: 'OUI',
      sub: rainingNow || wetT < 0
        ? word + ' en ce moment'
        : word + ' prévue vers ' + fmtDayHM(wetT, nowMs) + where,
      detail: radarOnly ? unforeseen
        : depMs < 0 ? noDryWindow : 'Sinon, prochain départ au sec : ' + fmtDayHM(depMs, nowMs) + '.',
    }
  }
  if (radarOnly) {
    return {
      state: 'pluie',
      big: 'PLUIE',
      sub: 'En ce moment, vue au radar',
      detail: unforeseen,
    }
  }
  const sub = rainingNow || wetT < 0
    ? 'En ce moment'
    : 'Prévue vers ' + fmtDayHM(wetT, nowMs) + where
  if (depMs < 0) {
    return { state: 'pluie', big: 'PLUIE', sub, detail: noDryWindow }
  }
  return {
    state: 'pluie',
    big: 'PLUIE',
    sub,
    detail: 'Sinon, prochain départ au sec : ' + fmtDayHM(depMs, nowMs) + '.',
  }
}
