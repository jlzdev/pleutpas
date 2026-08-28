import palette from './palette.json'
import { inFranceBounds, type MfEntry, type Place } from './meteo'

export interface OpenMeteoPayload {
  minutely_15: { time: number[]; precipitation: (number | null)[] }
  hourly: { time: number[]; precipitation: number[]; precipitation_probability: number[] }
}

export interface FutureFrame {
  time: number
  url: string
  bounds: [[number, number], [number, number]]
}

export interface FutureRain {
  piafRun: string | null
  aromeRun: string | null
  past: FutureFrame[]
  frames: FutureFrame[]
}

export interface GeoResult {
  name: string
  latitude: number
  longitude: number
  admin1?: string
  country?: string
}

// endpoint de l'app mobile Meteo-France, token public partage (non officiel, peut casser sans preavis)
const MF_TOKEN = '__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__'

export async function fetchWeather(place: Place): Promise<OpenMeteoPayload> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + place.lat + '&longitude=' + place.lon
    + '&minutely_15=precipitation'
    + '&hourly=precipitation,precipitation_probability'
    + '&forecast_days=2&timezone=auto&timeformat=unixtime'
  const res = await fetch(url)
  if (!res.ok) throw new Error('open-meteo http ' + res.status)
  return res.json()
}

export async function fetchRain(place: Place): Promise<MfEntry[] | null> {
  const res = await fetch('https://webservice.meteofrance.com/rain?lat=' + place.lat
    + '&lon=' + place.lon + '&token=' + MF_TOKEN)
  if (!res.ok) throw new Error('meteofrance http ' + res.status)
  const data = await res.json()
  // meteofrance.com affiche le forecast meme quand rain_product_available vaut 0 (constate a Royan sous orage) : seule l'absence de forecast fait foi
  if (!data.forecast || !data.forecast.length) return null
  const f: { dt: number; rain: number; desc: string }[] = data.forecast
  const entries: MfEntry[] = []
  for (let i = 0; i < f.length; i++) {
    const start = f[i].dt * 1000
    const dur = i + 1 < f.length ? (f[i + 1].dt - f[i].dt) * 1000
      : (i > 0 ? (f[i].dt - f[i - 1].dt) * 1000 : 600000)
    entries.push({ start, end: start + dur, level: f[i].rain, desc: f[i].desc })
  }
  return entries
}

const DATA_BASE: string = import.meta.env.VITE_DATA_BASE || 'https://raw.githubusercontent.com/jlzdev/pleutpas/data'
const PIAF_BASE: string = import.meta.env.VITE_PIAF_BASE || 'https://raw.githubusercontent.com/jlzdev/pleutpas/piaf'

interface FrameManifest {
  run: string
  past: FutureFrame[]
  frames: FutureFrame[]
}

async function fetchManifest(base: string): Promise<FrameManifest | null> {
  const res = await fetch(base + '/manifest.json')
  if (!res.ok) throw new Error('manifest frames http ' + res.status)
  const m = await res.json()
  if (!m.run || !m.bounds || !m.frames?.length) return null
  const toFrame = (f: { time: number; file: string }) => ({ time: f.time, url: base + '/' + f.file, bounds: m.bounds })
  return {
    run: m.run,
    past: (m.past ?? []).map(toFrame),
    frames: m.frames.map(toFrame),
  }
}

// PIAF (pas de 5 min, +3 h, run toutes les 5 min) porte le passe observe et le debut de
// l'animation, AROME-PI (pas de 15 min, +6 h, run horaire) prolonge au-dela de la fin de PIAF
export async function fetchFutureRain(): Promise<FutureRain | null> {
  const [piaf, arome] = await Promise.all([
    fetchManifest(PIAF_BASE).catch(() => null),
    fetchManifest(DATA_BASE).catch(() => null),
  ])
  if (!piaf && !arome) return null
  const lastPiaf = piaf ? piaf.frames[piaf.frames.length - 1].time : 0
  return {
    piafRun: piaf ? piaf.run : null,
    aromeRun: arome ? arome.run : null,
    past: piaf ? piaf.past : [],
    frames: [
      ...(piaf ? piaf.frames : []),
      ...(arome ? arome.frames.filter((f) => f.time > lastPiaf) : []),
    ],
  }
}

const WET_COLORS = palette.steps
  .filter((s) => s.mm >= palette.wetMm)
  .map((s) => [parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16)])

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

// echantillonne une frame lame d'eau PIAF (PNG de la branche piaf, lignes reechantillonnees
// en Mercator) au-dessus du lieu : fenetre 3x3 px (~5 km), mouille si un pixel porte une
// couleur de la palette au niveau bruine ou plus (les traces restent sous le seuil verdict)
export async function sampleFrameWet(frame: FutureFrame, lat: number, lon: number): Promise<boolean | null> {
  const [[south, west], [north, east]] = frame.bounds
  if (lat <= south || lat >= north || lon <= west || lon >= east) return null
  const res = await fetch(frame.url)
  if (!res.ok) throw new Error('frame pluie http ' + res.status)
  const bmp = await createImageBitmap(await res.blob())
  const cv = document.createElement('canvas')
  cv.width = bmp.width
  cv.height = bmp.height
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponible')
  ctx.drawImage(bmp, 0, 0)
  const x = Math.floor(((lon - west) / (east - west)) * bmp.width)
  const y = Math.floor(((merc(north) - merc(lat)) / (merc(north) - merc(south))) * bmp.height)
  const x0 = Math.max(0, x - 1)
  const y0 = Math.max(0, y - 1)
  const img = ctx.getImageData(x0, y0, Math.min(bmp.width - 1, x + 1) - x0 + 1, Math.min(bmp.height - 1, y + 1) - y0 + 1)
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 255
      && WET_COLORS.some((c) => c[0] === img.data[i] && c[1] === img.data[i + 1] && c[2] === img.data[i + 2])) {
      return true
    }
  }
  return false
}

export async function reverseGeocodeName(lat: number, lon: number): Promise<string | null> {
  const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat
    + '&longitude=' + lon + '&localityLanguage=fr')
  if (!res.ok) throw new Error('reverse-geocode http ' + res.status)
  const data = await res.json()
  return data.city || data.locality || null
}

export async function searchPlaces(q: string): Promise<GeoResult[]> {
  const res = await fetch('https://geocoding-api.open-meteo.com/v1/search?name='
    + encodeURIComponent(q) + '&count=20&language=fr&format=json')
  if (!res.ok) throw new Error('geocoding http ' + res.status)
  const data = await res.json()
  return ((data.results || []) as GeoResult[])
    .filter((r) => inFranceBounds(r.latitude, r.longitude))
    .slice(0, 5)
}
