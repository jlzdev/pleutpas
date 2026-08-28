import type { MfEntry, Place } from './meteo'

export interface OpenMeteoPayload {
  minutely_15: { time: number[]; precipitation: (number | null)[] }
  hourly: { time: number[]; precipitation: number[]; precipitation_probability: number[] }
}

export interface RadarFrame {
  time: number
  path: string
  type: 'obs' | 'fcst'
}

export interface RadarMaps {
  host: string
  frames: RadarFrame[]
}

export interface FutureFrame {
  time: number
  url: string
  bounds: [[number, number], [number, number]]
}

export interface FutureRain {
  piafRun: string | null
  aromeRun: string | null
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

export async function fetchRadarMaps(): Promise<RadarMaps> {
  const res = await fetch('https://api.rainviewer.com/public/weather-maps.json')
  if (!res.ok) throw new Error('rainviewer http ' + res.status)
  const wm = await res.json()
  const frames: RadarFrame[] = [
    ...(wm.radar?.past || []).map((f: { time: number; path: string }) => ({ ...f, type: 'obs' as const })),
    ...(wm.radar?.nowcast || []).map((f: { time: number; path: string }) => ({ ...f, type: 'fcst' as const })),
  ]
  return { host: wm.host, frames }
}

const DATA_BASE: string = import.meta.env.VITE_DATA_BASE || 'https://raw.githubusercontent.com/jlzdev/pleutpas/data'
const PIAF_BASE: string = import.meta.env.VITE_PIAF_BASE || 'https://raw.githubusercontent.com/jlzdev/pleutpas/piaf'

interface FrameManifest {
  run: string
  frames: FutureFrame[]
}

async function fetchManifest(base: string): Promise<FrameManifest | null> {
  const res = await fetch(base + '/manifest.json')
  if (!res.ok) throw new Error('manifest frames http ' + res.status)
  const m = await res.json()
  if (!m.run || !m.bounds || !m.frames?.length) return null
  return {
    run: m.run,
    frames: m.frames.map((f: { time: number; file: string }) => ({ time: f.time, url: base + '/' + f.file, bounds: m.bounds })),
  }
}

// PIAF (pas de 5 min, +3 h, run toutes les 5 min) porte le debut de l'animation,
// AROME-PI (pas de 15 min, +6 h, run horaire) prolonge au-dela de la fin de PIAF
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
    frames: [
      ...(piaf ? piaf.frames : []),
      ...(arome ? arome.frames.filter((f) => f.time > lastPiaf) : []),
    ],
  }
}

async function tileEchoCount(url: string, x0: number, y0: number, x1: number, y1: number): Promise<number> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('tuile radar http ' + res.status)
  const bmp = await createImageBitmap(await res.blob())
  const cv = document.createElement('canvas')
  cv.width = bmp.width
  cv.height = bmp.height
  const ctx = cv.getContext('2d')
  if (!ctx) throw new Error('canvas 2d indisponible')
  ctx.drawImage(bmp, 0, 0)
  const img = ctx.getImageData(x0, y0, x1 - x0 + 1, y1 - y0 + 1)
  let n = 0
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] === 255) n++
  }
  return n
}

// echantillonne les images radar au-dessus du lieu (rayon ~2.5 km au zoom 7, grille max gratuite RainViewer),
// en chargeant aussi les tuiles voisines quand le disque chevauche une frontiere de tuile.
// Calibre contre MF pluie dans l'heure le 2026-08-28 : les classes faibles de la palette (alpha < 255,
// des -2 dBZ) sont le plus souvent non precipitantes au sol, seul un echo sature sur au moins
// 2 pixels des tuiles brutes (option 0_0, sans lissage) vaut pluie probable
export async function sampleRadarAt(host: string, path: string, lat: number, lon: number): Promise<boolean> {
  const z = 7
  const n = 1 << z
  const ts = 256
  const R = 3
  const xf = (lon + 180) / 360 * n
  const latR = lat * Math.PI / 180
  const yf = (1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n
  const gx = Math.min(n * ts - 1, Math.floor(xf * ts))
  const gy = Math.min(n * ts - 1, Math.floor(yf * ts))
  const x0 = Math.max(0, gx - R)
  const x1 = Math.min(n * ts - 1, gx + R)
  const y0 = Math.max(0, gy - R)
  const y1 = Math.min(n * ts - 1, gy + R)
  const mainTx = Math.floor(gx / ts)
  const mainTy = Math.floor(gy / ts)
  let saturated = 0
  for (let ty = Math.floor(y0 / ts); ty <= Math.floor(y1 / ts); ty++) {
    for (let tx = Math.floor(x0 / ts); tx <= Math.floor(x1 / ts); tx++) {
      const url = host + path + '/' + ts + '/' + z + '/' + tx + '/' + ty + '/2/0_0.png'
      try {
        saturated += await tileEchoCount(
          url,
          Math.max(x0, tx * ts) - tx * ts,
          Math.max(y0, ty * ts) - ty * ts,
          Math.min(x1, (tx + 1) * ts - 1) - tx * ts,
          Math.min(y1, (ty + 1) * ts - 1) - ty * ts,
        )
        if (saturated >= 2) return true
      } catch (e) {
        if (tx === mainTx && ty === mainTy) throw e
      }
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
    + encodeURIComponent(q) + '&count=5&language=fr&format=json')
  if (!res.ok) throw new Error('geocoding http ' + res.status)
  const data = await res.json()
  return data.results || []
}
