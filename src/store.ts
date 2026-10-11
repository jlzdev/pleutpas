import { computed, ref } from 'vue'
import {
  BESANCON,
  cleanName,
  displayZone,
  estimatedTripMin,
  inFranceBounds,
  MAX_TRIP_MIN,
  MIN_TRIP_MIN,
  tripPositions,
  type FrameSample,
  type MfEntry,
  type Place,
  type Slot,
  type Trip,
} from './lib/meteo'
import { parseHHMM } from './lib/ics'
import {
  fetchFutureRain,
  fetchRain,
  fetchWeather,
  forgetFrameImages,
  loadFrameImage,
  sampleFramePoints,
  type FutureRain,
  type OpenMeteoPayload,
} from './lib/api'

const KEY_TRIP = 'pleutpas.tripMin'
const KEY_PLACE = 'pleutpas.place'
const KEY_DEST = 'pleutpas.dest'
const KEY_CACHE = 'pleutpas.cache'
const KEY_BASEMAP = 'pleutpas.basemap'
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
  return { name: cleanName(q.get(nameKey)) || lat.toFixed(2) + ' ' + lon.toFixed(2), lat, lon }
}

function loadPlaces(): [Place, Place | null] {
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
  return [place ?? BESANCON, place ? dest : null]
}

export type Basemap = 'plan' | 'velo'

const [initialPlace, initialDest] = loadPlaces()

function clampTrip(v: number): number {
  return Math.min(MAX_TRIP_MIN, Math.max(MIN_TRIP_MIN, v))
}

function loadTrip(): number {
  return clampTrip(parseInt(lsGet(KEY_TRIP) ?? '', 10) || 15)
}

export const place = ref<Place>(initialPlace)
export const dest = ref<Place | null>(initialDest)
export const basemap = ref<Basemap>(lsGet(KEY_BASEMAP) === 'velo' ? 'velo' : 'plan')
export const tripMin = ref(loadTrip())
export const reminderTime = ref(parseHHMM(lsGet(KEY_REMINDER) ?? '') ? lsGet(KEY_REMINDER) as string : '08:00')
export const weather = ref<OpenMeteoPayload | null>(null)
export const weatherDest = ref<OpenMeteoPayload | null>(null)
export const fetchedAt = ref<number | null>(null)
export const rainMF = ref<MfEntry[] | null>(null)
export const rainMFDest = ref<MfEntry[] | null>(null)
export const frameSamples = ref<FrameSample[] | null>(null)
export const radarPending = ref(false)
export const futureRain = ref<FutureRain | null>(null)
export const refreshing = ref(false)
export const nowTick = ref(Date.now())
export const recenterTick = ref(0)

function toSlots(payload: OpenMeteoPayload | null): Slot[] {
  if (!payload) return []
  const t = payload.minutely_15.time
  const p = payload.minutely_15.precipitation
  const out: Slot[] = []
  for (let i = 0; i < t.length; i++) {
    const mm = p[i]
    if (mm === null || mm === undefined) break
    out.push({ start: t[i] * 1000, mm })
  }
  return out
}

export const slots = computed<Slot[]>(() => toSlots(weather.value))
export const slotsDest = computed<Slot[]>(() => toSlots(weatherDest.value))

export const trip = computed<Trip>(() => {
  const hasDest = dest.value !== null
  return {
    positions: tripPositions(place.value, dest.value),
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
  const d = dest.value
  const places = d ? [p, d] : [p]
  refreshing.value = true
  radarPending.value = true
  if (fromButton) recenterTick.value++
  const futP = fetchFutureRain().catch(() => null)
  const [w, r, rd] = await Promise.allSettled([
    fetchWeather(places),
    fetchRain(p),
    d ? fetchRain(d) : Promise.resolve(null),
  ])
  if (seq !== refreshSeq) return
  const key = cacheKey(p, d)
  if (w.status === 'fulfilled') {
    displayZone.value = w.value[0].timezone
    weather.value = w.value[0]
    weatherDest.value = w.value[1] ?? null
    fetchedAt.value = Date.now()
    lsSet(KEY_CACHE, JSON.stringify({ at: fetchedAt.value, key, payloads: w.value }))
  } else if (!weather.value) {
    try {
      const c = JSON.parse(lsGet(KEY_CACHE) ?? 'null')
      if (c && c.payloads && c.key === key) {
        displayZone.value = c.payloads[0].timezone
        weather.value = c.payloads[0]
        weatherDest.value = c.payloads[1] ?? null
        fetchedAt.value = c.at
      }
    } catch { /* entree corrompue */ }
  }
  rainMF.value = r.status === 'fulfilled' ? r.value : null
  rainMFDest.value = rd.status === 'fulfilled' ? rd.value : null
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
  weather.value = null
  weatherDest.value = null
  fetchedAt.value = null
  frameSamples.value = null
  recenterTick.value++
  void refresh(false)
}

export function setPlace(p: Place): void {
  place.value = p
  lsSet(KEY_PLACE, JSON.stringify(p))
  resetData()
}

export function setDest(d: Place | null): void {
  dest.value = d
  if (d) {
    lsSet(KEY_DEST, JSON.stringify(d))
    setTripMin(clampTrip(estimatedTripMin(place.value, d)))
  } else {
    lsRemove(KEY_DEST)
  }
  resetData()
}

export function swapPlaces(): void {
  const d = dest.value
  if (!d) return
  const p = place.value
  place.value = d
  dest.value = p
  lsSet(KEY_PLACE, JSON.stringify(d))
  lsSet(KEY_DEST, JSON.stringify(p))
  resetData()
}

export function setBasemap(b: Basemap): void {
  basemap.value = b
  lsSet(KEY_BASEMAP, b)
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (fetchedAt.value === null || Date.now() - fetchedAt.value > 5 * 60 * 1000) {
      void refresh(false)
    } else {
      nowTick.value = Date.now()
    }
  })
  setInterval(() => { nowTick.value = Date.now() }, 60 * 1000)
  void refresh(false)
}

declare global {
  interface Window { __pp: Record<string, unknown> }
}
window.__pp = {
  place, dest, tripMin, weather, weatherDest, fetchedAt, rainMF, rainMFDest, frameSamples, radarPending, refreshing,
  futureRain, slots, slotsDest, trip, nowTick, displayZone, refresh, setPlace, setDest, swapPlaces,
}
