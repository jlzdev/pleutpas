import { fmtDayHM, type InfoText, type Place } from './meteo'

const DAY_MS = 86400000
const J2000 = 2451545
const UNIX_JD = 2440587.5
const SUN_ALT_DEG = -0.833
const OBLIQUITY_DEG = 23.4397
const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI

export interface SunEvents {
  rise: number
  set: number
}

// equation du lever et du coucher (algorithme NOAA simplifie), precision de l'ordre de la minute
export function sunEvents(lat: number, lon: number, dayNumber: number): SunEvents | null {
  const jStar = dayNumber - lon / 360
  const m = rad((357.5291 + 0.98560028 * jStar) % 360)
  const c = 1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m)
  const lambda = rad((deg(m) + c + 180 + 102.9372) % 360)
  const transit = J2000 + jStar + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * lambda)
  const sinDec = Math.sin(lambda) * Math.sin(rad(OBLIQUITY_DEG))
  const cosDec = Math.cos(Math.asin(sinDec))
  const cosHa = (Math.sin(rad(SUN_ALT_DEG)) - Math.sin(rad(lat)) * sinDec) / (Math.cos(rad(lat)) * cosDec)
  if (cosHa < -1 || cosHa > 1) return null
  const ha = deg(Math.acos(cosHa)) / 360
  const toMs = (jd: number) => Math.round((jd - UNIX_JD) * DAY_MS)
  return { rise: toMs(transit - ha), set: toMs(transit + ha) }
}

export function dayNumber(tMs: number): number {
  return Math.floor(tMs / DAY_MS + UNIX_JD - J2000 + 0.5)
}

export interface Daylight {
  dark: boolean
  next: number
}

export function daylightAt(lat: number, lon: number, tMs: number): Daylight | null {
  const n = dayNumber(tMs)
  const events: { t: number; rise: boolean }[] = []
  for (const d of [n - 1, n, n + 1]) {
    const e = sunEvents(lat, lon, d)
    if (!e) return null
    events.push({ t: e.rise, rise: true }, { t: e.set, rise: false })
  }
  events.sort((a, b) => a.t - b.t)
  const i = events.findIndex((e) => e.t > tMs)
  if (i <= 0) return null
  return { dark: events[i].rise, next: events[i].t }
}

const SUNSET_AHEAD_MS = 60 * 60000

export function sunNote(place: Place, departMs: number, tripMin: number, nowMs: number): InfoText | null {
  const d = daylightAt(place.lat, place.lon, departMs)
  if (!d) return null
  if (d.dark) return { text: 'Nuit jusqu\'à ' + fmtDayHM(d.next, nowMs) + '.', strong: false }
  if (d.next <= departMs + tripMin * 60000 + SUNSET_AHEAD_MS) return { text: 'Nuit à partir de ' + fmtDayHM(d.next, nowMs) + '.', strong: false }
  return null
}
