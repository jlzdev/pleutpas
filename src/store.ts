import { computed, ref } from 'vue'
import { BESANCON, type MfEntry, type Place, type Slot } from './lib/meteo'
import {
  fetchRadarMaps,
  fetchRain,
  fetchWeather,
  sampleRadarAt,
  type OpenMeteoPayload,
  type RadarMaps,
} from './lib/api'

const KEY_TRIP = 'pleutpas.tripMin'
const KEY_PLACE = 'pleutpas.place'
const KEY_CACHE = 'pleutpas.cache'

function loadTrip(): number {
  let v = 15
  try { v = parseInt(localStorage.getItem(KEY_TRIP) ?? '', 10) || 15 } catch { /* stockage indisponible */ }
  return Math.min(60, Math.max(5, v))
}

function loadPlace(): Place {
  const q = new URLSearchParams(location.search)
  const lat = parseFloat(q.get('lat') ?? '')
  const lon = parseFloat(q.get('lon') ?? '')
  if (isFinite(lat) && isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const p: Place = { name: q.get('nom') || lat.toFixed(2) + ', ' + lon.toFixed(2), lat, lon }
    try { localStorage.setItem(KEY_PLACE, JSON.stringify(p)) } catch { /* stockage indisponible */ }
    return p
  }
  try {
    const p = JSON.parse(localStorage.getItem(KEY_PLACE) ?? 'null')
    if (p && isFinite(p.lat) && isFinite(p.lon) && p.name) return p
  } catch { /* stockage indisponible */ }
  return BESANCON
}

export const place = ref<Place>(loadPlace())
export const tripMin = ref(loadTrip())
export const weather = ref<OpenMeteoPayload | null>(null)
export const fetchedAt = ref<number | null>(null)
export const rainMF = ref<MfEntry[] | null>(null)
export const radarWetNow = ref<boolean | null>(null)
export const radarMaps = ref<RadarMaps | null>(null)
export const radarError = ref(false)
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
    out.push({ start: new Date(t[i]).getTime(), mm })
  }
  return out
})

export async function refresh(fromButton = false): Promise<void> {
  refreshing.value = true
  if (fromButton) recenterTick.value++
  const [w, r] = await Promise.allSettled([fetchWeather(place.value), fetchRain(place.value)])
  if (w.status === 'fulfilled') {
    weather.value = w.value
    fetchedAt.value = Date.now()
    try {
      localStorage.setItem(KEY_CACHE, JSON.stringify({
        at: fetchedAt.value, lat: place.value.lat, lon: place.value.lon, payload: w.value,
      }))
    } catch { /* stockage indisponible */ }
  } else if (!weather.value) {
    try {
      const c = JSON.parse(localStorage.getItem(KEY_CACHE) ?? 'null')
      if (c && c.payload && c.lat === place.value.lat && c.lon === place.value.lon) {
        weather.value = c.payload
        fetchedAt.value = c.at
      }
    } catch { /* stockage indisponible */ }
  }
  rainMF.value = r.status === 'fulfilled' ? r.value : null
  radarWetNow.value = null
  radarError.value = false
  try {
    const maps = await fetchRadarMaps()
    radarMaps.value = maps
    const lastObs = maps.frames.filter(f => f.type === 'obs').pop()
    if (lastObs) {
      try {
        radarWetNow.value = await sampleRadarAt(maps.host, lastObs.path, place.value.lat, place.value.lon)
      } catch { /* echantillonnage impossible, verdict sans radar */ }
    }
  } catch {
    radarError.value = true
  }
  nowTick.value = Date.now()
  refreshing.value = false
}

export function setPlace(p: Place): void {
  place.value = p
  try { localStorage.setItem(KEY_PLACE, JSON.stringify(p)) } catch { /* stockage indisponible */ }
  weather.value = null
  fetchedAt.value = null
  recenterTick.value++
  void refresh(false)
}

export function setTripMin(n: number): void {
  tripMin.value = n
  try { localStorage.setItem(KEY_TRIP, String(n)) } catch { /* stockage indisponible */ }
}

export function initStore(): void {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && fetchedAt.value && Date.now() - fetchedAt.value > 5 * 60 * 1000) {
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
window.__pp = { place, tripMin, weather, fetchedAt, rainMF, radarWetNow, radarMaps, slots, nowTick, refresh, setPlace }
