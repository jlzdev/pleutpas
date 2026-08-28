import { computed, ref } from 'vue'
import { BESANCON, inFranceBounds, type MfEntry, type Place, type Slot } from './lib/meteo'
import {
  fetchFutureRain,
  fetchRain,
  fetchWeather,
  sampleFrameWet,
  type FutureRain,
  type OpenMeteoPayload,
} from './lib/api'

const KEY_TRIP = 'pleutpas.tripMin'
const KEY_PLACE = 'pleutpas.place'
const KEY_CACHE = 'pleutpas.cache'

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* stockage indisponible */ }
}

function loadTrip(): number {
  const v = parseInt(lsGet(KEY_TRIP) ?? '', 10) || 15
  return Math.min(60, Math.max(5, v))
}

function cleanName(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40)
}

function loadPlace(): Place {
  const q = new URLSearchParams(location.search)
  const lat = parseFloat(q.get('lat') ?? '')
  const lon = parseFloat(q.get('lon') ?? '')
  if (q.has('lat') || q.has('lon') || q.has('nom')) {
    history.replaceState(null, '', location.pathname)
  }
  if (isFinite(lat) && isFinite(lon) && inFranceBounds(lat, lon)) {
    const p: Place = { name: cleanName(q.get('nom')) || lat.toFixed(2) + ', ' + lon.toFixed(2), lat, lon }
    lsSet(KEY_PLACE, JSON.stringify(p))
    return p
  }
  try {
    const p = JSON.parse(lsGet(KEY_PLACE) ?? 'null')
    if (p && isFinite(p.lat) && isFinite(p.lon) && inFranceBounds(p.lat, p.lon) && cleanName(p.name)) {
      return { name: cleanName(p.name), lat: p.lat, lon: p.lon }
    }
  } catch { /* entree corrompue */ }
  return BESANCON
}

export const place = ref<Place>(loadPlace())
export const tripMin = ref(loadTrip())
export const weather = ref<OpenMeteoPayload | null>(null)
export const fetchedAt = ref<number | null>(null)
export const rainMF = ref<MfEntry[] | null>(null)
export const radarWetNow = ref<boolean | null>(null)
export const radarPending = ref(false)
export const futureRain = ref<FutureRain | null>(null)
export const refreshing = ref(false)
export const nowTick = ref(Date.now())
export const recenterTick = ref(0)

export const slots = computed<Slot[]>(() => {
  if (!weather.value) return []
  const t = weather.value.minutely_15.time
  const p = weather.value.minutely_15.precipitation
  const out: Slot[] = []
  for (let i = 0; i < t.length; i++) {
    const mm = p[i]
    if (mm === null || mm === undefined) break
    out.push({ start: t[i] * 1000, mm })
  }
  return out
})

function hasFuture(fut: FutureRain | null): boolean {
  return !!fut && fut.frames.some(f => f.time * 1000 > Date.now())
}

let refreshSeq = 0

export async function refresh(fromButton = false): Promise<void> {
  const seq = ++refreshSeq
  const p = place.value
  refreshing.value = true
  radarPending.value = true
  if (fromButton) recenterTick.value++
  const futP = fetchFutureRain().catch(() => null)
  const [w, r] = await Promise.allSettled([fetchWeather(p), fetchRain(p)])
  if (seq !== refreshSeq) return
  if (w.status === 'fulfilled') {
    weather.value = w.value
    fetchedAt.value = Date.now()
    lsSet(KEY_CACHE, JSON.stringify({ at: fetchedAt.value, lat: p.lat, lon: p.lon, payload: w.value }))
  } else if (!weather.value) {
    try {
      const c = JSON.parse(lsGet(KEY_CACHE) ?? 'null')
      if (c && c.payload && c.lat === p.lat && c.lon === p.lon) {
        weather.value = c.payload
        fetchedAt.value = c.at
      }
    } catch { /* entree corrompue */ }
  }
  rainMF.value = r.status === 'fulfilled' ? r.value : null
  const fut = await futP
  let wet: boolean | null = null
  const past = fut?.past ?? []
  const lastPast = past[past.length - 1]
  const prevPast = past[past.length - 2]
  if (lastPast) {
    try {
      wet = await sampleFrameWet(lastPast, p.lat, p.lon)
      if (wet && prevPast) {
        // une pluie reelle persiste d'une image a l'autre, un parasite isole non
        try {
          const confirm = await sampleFrameWet(prevPast, p.lat, p.lon)
          if (confirm !== null) wet = confirm
        } catch { /* confirmation impossible, on garde l'echo simple */ }
      }
    } catch { /* echantillonnage impossible, verdict sans radar */ }
  }
  if (seq !== refreshSeq) return
  radarWetNow.value = wet
  radarPending.value = false
  futureRain.value = hasFuture(fut) ? fut : (hasFuture(futureRain.value) ? futureRain.value : null)
  nowTick.value = Date.now()
  refreshing.value = false
}

export function setPlace(p: Place): void {
  place.value = p
  lsSet(KEY_PLACE, JSON.stringify(p))
  weather.value = null
  fetchedAt.value = null
  radarWetNow.value = null
  recenterTick.value++
  void refresh(false)
}

export function setTripMin(n: number): void {
  tripMin.value = n
  lsSet(KEY_TRIP, String(n))
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
window.__pp = { place, tripMin, weather, fetchedAt, rainMF, radarWetNow, radarPending, futureRain, slots, nowTick, refresh, setPlace }
