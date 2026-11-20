import { computed, ref, watch } from 'vue'
import {
  cleanName,
  coordsName,
  displayZone,
  estimatedTripMin,
  hourlyEndMs,
  inFranceBounds,
  isMfPointUsable,
  MAX_TRIP_MIN,
  MIN_TRIP_MIN,
  STEP_5MIN_MS,
  tripPositions,
  type FrameSample,
  type MfEntry,
  type MfForecast,
  type Place,
  type PointForecast,
  type Slot,
  type Trip,
  type Vigilance,
} from './lib/meteo'
import { parseHHMM } from './lib/ics'
import {
  fetchForecastMF,
  fetchFutureRain,
  fetchRain,
  fetchVigilance,
  fetchWarning,
  fetchWeather,
  forgetFrameImages,
  loadFrameImage,
  sampleFramePoints,
  type FutureRain,
} from './lib/api'

const KEY_TRIP = 'pleutpas.tripMin'
const KEY_PLACE = 'pleutpas.place'
const KEY_DEST = 'pleutpas.dest'
const KEY_CACHE = 'pleutpas.cache'
const KEY_REMINDER = 'pleutpas.reminderTime'

export function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* stockage indisponible */ }
}

function lsRemove(key: string): void {
  try { localStorage.removeItem(key) } catch { /* stockage indisponible */ }
}

function parsePlace(raw: unknown): Place | null {
  const p = raw as { name?: unknown; lat?: unknown; lon?: unknown } | null
  if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return null
  if (!isFinite(p.lat) || !isFinite(p.lon) || !inFranceBounds(p.lat, p.lon)) return null
  const name = cleanName(p.name)
  return name ? { name, lat: p.lat, lon: p.lon } : null
}

function placeFromQuery(q: URLSearchParams, latKey: string, lonKey: string, nameKey: string): Place | null {
  const lat = parseFloat(q.get(latKey) ?? '')
  const lon = parseFloat(q.get(lonKey) ?? '')
  if (!isFinite(lat) || !isFinite(lon) || !inFranceBounds(lat, lon)) return null
  return { name: cleanName(q.get(nameKey)) || coordsName(lat, lon), lat, lon }
}

function loadPlaces(): [Place | null, Place | null] {
  const q = new URLSearchParams(location.search)
  const keys = ['lat', 'lon', 'nom', 'alat', 'alon', 'anom']
  const fromUrl = keys.some((k) => q.has(k))
  if (fromUrl) history.replaceState(null, '', location.pathname)
  const urlPlace = placeFromQuery(q, 'lat', 'lon', 'nom')
  if (urlPlace) {
    const urlDest = placeFromQuery(q, 'alat', 'alon', 'anom')
    lsSet(KEY_PLACE, JSON.stringify(urlPlace))
    if (urlDest) lsSet(KEY_DEST, JSON.stringify(urlDest))
    else lsRemove(KEY_DEST)
    return [urlPlace, urlDest]
  }
  let place: Place | null = null
  let dest: Place | null = null
  try { place = parsePlace(JSON.parse(lsGet(KEY_PLACE) ?? 'null')) } catch { /* entree corrompue */ }
  try { dest = parsePlace(JSON.parse(lsGet(KEY_DEST) ?? 'null')) } catch { /* entree corrompue */ }
  if (!place) lsRemove(KEY_DEST)
  return [place, place ? dest : null]
}

const [initialPlace, initialDest] = loadPlaces()

function clampTrip(v: number): number {
  return Math.min(MAX_TRIP_MIN, Math.max(MIN_TRIP_MIN, v))
}

function loadTrip(): number {
  return clampTrip(parseInt(lsGet(KEY_TRIP) ?? '', 10) || 15)
}

export const place = ref<Place | null>(initialPlace)
export const dest = ref<Place | null>(initialDest)
export const tripMin = ref(loadTrip())
export const reminderTime = ref(parseHHMM(lsGet(KEY_REMINDER) ?? '') ? lsGet(KEY_REMINDER) as string : '08:00')
export const forecast = ref<PointForecast | null>(null)
export const forecastDest = ref<PointForecast | null>(null)
export const fetchedAt = ref<number | null>(null)
export const rainMF = ref<MfEntry[] | null>(null)
export const rainMFDest = ref<MfEntry[] | null>(null)
export const forecastMF = ref<MfForecast | null>(null)
export const forecastMFDest = ref<MfForecast | null>(null)
export const vigilance = ref<Vigilance | null>(null)
export const frameSamples = ref<FrameSample[] | null>(null)
export const radarPending = ref(false)
export const futureRain = ref<FutureRain | null>(null)
export const refreshing = ref(false)
export const nowTick = ref(Date.now())
export const recenterTick = ref(0)
export const departAt = ref<number | null>(null)
export const refMs = computed(() => (departAt.value !== null && departAt.value > nowTick.value ? departAt.value : nowTick.value))
watch(nowTick, (t) => { if (departAt.value !== null && departAt.value < t + STEP_5MIN_MS) departAt.value = null })

export function setDepartAt(ms: number | null): void {
  departAt.value = ms !== null && ms >= Date.now() + STEP_5MIN_MS ? ms : null
}

export const slots = computed<Slot[]>(() => forecast.value?.rain ?? [])
export const slotsDest = computed<Slot[]>(() => forecastDest.value?.rain ?? [])

export const trip = computed<Trip>(() => {
  const hasDest = dest.value !== null
  const p = place.value
  return {
    positions: p ? tripPositions(p, dest.value) : [],
    hasDest,
    mf: [rainMF.value, hasDest ? rainMFDest.value : rainMF.value],
    slots: [slots.value, hasDest ? slotsDest.value : slots.value],
    samples: frameSamples.value,
  }
})

function hasFuture(fut: FutureRain | null): boolean {
  return !!fut && fut.frames.some(f => f.time * 1000 > Date.now())
}

function cacheKey(p: Place, d: Place | null): string {
  return p.lat + ',' + p.lon + (d ? '|' + d.lat + ',' + d.lon : '')
}

async function sampleFrames(
  fut: FutureRain | null,
  positions: Place[],
  hasDest: boolean,
  tripMin: number,
  publish: (samples: FrameSample[], done: boolean) => boolean,
): Promise<void> {
  if (!fut) {
    publish([], true)
    return
  }
  forgetFrameImages(new Set([...fut.past, ...fut.frames].map((f) => f.url)))
  const now = Date.now()
  const past = fut.past.slice(-2)
  const future = hasDest ? fut.frames.filter((f) => !fut.past.some((p) => p.time === f.time)) : []
  const wanted = [
    ...past.map((f) => ({ f, past: true })),
    ...future.map((f) => ({ f, past: false })),
  ].sort((a, b) => Math.abs(a.f.time * 1000 - now) - Math.abs(b.f.time * 1000 - now))
  wanted.forEach(({ f }) => { loadFrameImage(f.url).catch(() => undefined) })
  const urgentUntil = now + (tripMin + 10) * 60000
  const out: FrameSample[] = []
  let published = false
  for (let i = 0; i < wanted.length; i++) {
    const { f, past: isPast } = wanted[i]
    try {
      out.push({ time: f.time * 1000, past: isPast, mm: await sampleFramePoints(f, positions) })
    } catch { /* image illisible, on passe */ }
    const next = wanted[i + 1]
    if (!published && (!next || next.f.time * 1000 > urgentUntil)) {
      published = true
      if (!publish([...out].sort((a, b) => a.time - b.time), !next)) return
      if (!next) return
    }
  }
  publish(out.sort((a, b) => a.time - b.time), true)
}

let refreshSeq = 0

export async function refresh(fromButton = false): Promise<void> {
  const seq = ++refreshSeq
  const p = place.value
  if (!p) return
  const d = dest.value
  const places = d ? [p, d] : [p]
  refreshing.value = true
  radarPending.value = true
  if (fromButton) recenterTick.value++
  const futP = fetchFutureRain().catch(() => null)
  const now = Date.now()
  const abroad = (m: MfForecast | null) => !!m?.country && !m.country.startsWith('FR')
  const earlyOm = places.filter((_, i) => abroad(i === 0 ? forecastMF.value : forecastMFDest.value))
  const earlyP = earlyOm.length ? fetchWeather(earlyOm, now).catch(() => null) : null
  const [r, rd, f, fd] = await Promise.allSettled([
    fetchRain(p),
    d ? fetchRain(d) : Promise.resolve(null),
    fetchForecastMF(p, now),
    d ? fetchForecastMF(d, now) : Promise.resolve(null),
  ])
  if (seq !== refreshSeq) return
  const settled = <T>(x: PromiseSettledResult<T | null>): T | null => (x.status === 'fulfilled' ? x.value : null)
  const rain = settled(r)
  const rainDest = settled(rd)
  const fc = f.status === 'fulfilled' ? f.value : forecastMF.value
  const fcDest = fd.status === 'fulfilled' ? fd.value : forecastMFDest.value
  const points: (PointForecast | null)[] = [fc, fcDest].slice(0, places.length)
    .map((m) => (m && isMfPointUsable(m, now) ? m.point : null))
  const needOm = places.filter((_, i) => !points[i])
  if (needOm.length) {
    const got = new Map<Place, PointForecast>()
    const early = earlyP ? await earlyP : null
    early?.forEach((pt, i) => got.set(earlyOm[i], pt))
    const missing = needOm.filter((pl) => !got.has(pl))
    const om = missing.length ? await fetchWeather(missing, now).catch(() => null) : null
    if (seq !== refreshSeq) return
    om?.forEach((pt, i) => got.set(missing[i], pt))
    points.forEach((pt, i) => { if (!pt) points[i] = got.get(places[i]) ?? null })
  }
  const key = cacheKey(p, d)
  if (points[0]) {
    displayZone.value = points[0].timezone ?? undefined
    forecast.value = points[0]
    forecastDest.value = points[1] ?? null
    fetchedAt.value = Date.now()
    lsSet(KEY_CACHE, JSON.stringify({ v: 2, at: fetchedAt.value, key, forecasts: points }))
  } else if (!forecast.value) {
    try {
      const c = JSON.parse(lsGet(KEY_CACHE) ?? 'null')
      if (c && c.v === 2 && Array.isArray(c.forecasts) && c.key === key && c.forecasts[0]) {
        displayZone.value = c.forecasts[0].timezone ?? undefined
        forecast.value = c.forecasts[0]
        forecastDest.value = c.forecasts[1] ?? null
        fetchedAt.value = c.at
      }
    } catch { /* entree corrompue */ }
  }
  rainMF.value = rain?.entries ?? null
  rainMFDest.value = rainDest?.entries ?? null
  forecastMF.value = fc
  forecastMFDest.value = fcDest
  void fetchVigilance([fc?.dept ?? rain?.dept ?? null, d ? (fcDest?.dept ?? rainDest?.dept ?? null) : null])
    .then((v) => { if (seq === refreshSeq) vigilance.value = v }, () => undefined)
  const fut = await futP
  if (seq !== refreshSeq) return
  futureRain.value = hasFuture(fut) ? fut : (hasFuture(futureRain.value) ? futureRain.value : null)
  await sampleFrames(fut, tripPositions(p, d), d !== null, tripMin.value, (samples, done) => {
    if (seq !== refreshSeq) return false
    frameSamples.value = samples
    radarPending.value = false
    nowTick.value = Date.now()
    if (done) refreshing.value = false
    return true
  })
}

function resetData(): void {
  forecast.value = null
  forecastDest.value = null
  fetchedAt.value = null
  frameSamples.value = null
  forecastMF.value = null
  forecastMFDest.value = null
  vigilance.value = null
  recenterTick.value++
  void refresh(false)
}

export function setPlace(p: Place): void {
  place.value = p
  lsSet(KEY_PLACE, JSON.stringify(p))
  resetData()
}

export function setDest(d: Place | null): void {
  const p = place.value
  if (!p) return
  dest.value = d
  if (d) {
    lsSet(KEY_DEST, JSON.stringify(d))
    setTripMin(clampTrip(estimatedTripMin(p, d)))
  } else {
    lsRemove(KEY_DEST)
  }
  resetData()
}

export function swapPlaces(): void {
  const d = dest.value
  const p = place.value
  if (!d || !p) return
  place.value = d
  dest.value = p
  lsSet(KEY_PLACE, JSON.stringify(d))
  lsSet(KEY_DEST, JSON.stringify(p))
  resetData()
}

export function setTripMin(n: number): void {
  tripMin.value = n
  lsSet(KEY_TRIP, String(n))
}

export function setReminderTime(v: string): void {
  if (!parseHHMM(v)) return
  reminderTime.value = v
  lsSet(KEY_REMINDER, v)
}

export function initStore(): void {
  lsRemove('pleutpas.basemap')
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !place.value) return
    if (fetchedAt.value === null || Date.now() - fetchedAt.value > 5 * 60 * 1000) {
      void refresh(false)
    } else {
      nowTick.value = Date.now()
    }
  })
  setInterval(() => { nowTick.value = Date.now() }, 60 * 1000)
  if (place.value) void refresh(false)
}

declare global {
  interface Window { __pp: Record<string, unknown> }
}
window.__pp = {
  place, dest, tripMin, forecast, forecastDest, fetchedAt, rainMF, rainMFDest, forecastMF, forecastMFDest, vigilance,
  frameSamples, radarPending, refreshing, futureRain, slots, slotsDest, trip, nowTick, displayZone, departAt, refMs,
  refresh, setPlace, setDest, swapPlaces, setDepartAt, fetchWarning, isMfPointUsable, hourlyEndMs,
}
