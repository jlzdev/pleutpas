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
  lat: number
  lon: number
  area: string
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

const STEP_COLORS = palette.steps.map((s) => ({
  mm: s.mm,
  rgb: [parseInt(s.hex.slice(1, 3), 16), parseInt(s.hex.slice(3, 5), 16), parseInt(s.hex.slice(5, 7), 16)],
}))

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))

// echantillonne une frame lame d'eau PIAF (PNG de la branche piaf, lignes reechantillonnees
// en Mercator) au-dessus du lieu : fenetre 3x3 px (~5 km), renvoie l'intensite la plus
// forte trouvee (mm / 15 min de la palette, 0 si aucun pixel colore), null hors de la frame
export async function sampleFrameMm(frame: FutureFrame, lat: number, lon: number): Promise<number | null> {
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
  let max = 0
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] !== 255) continue
    const step = STEP_COLORS.find((c) => c.rgb[0] === img.data[i] && c.rgb[1] === img.data[i + 1] && c.rgb[2] === img.data[i + 2])
    if (step && step.mm > max) max = step.mm
  }
  return max
}

// commune contenant le point (API Decoupage administratif, polygone), fiable meme en
// pleine campagne la ou le geocodage inverse par adresse ne renvoie rien
export async function reverseGeocodeName(lat: number, lon: number): Promise<string | null> {
  const res = await fetch('https://geo.api.gouv.fr/communes?lat=' + lat + '&lon=' + lon + '&fields=nom')
  if (!res.ok) throw new Error('communes http ' + res.status)
  const data: { nom?: string }[] = await res.json()
  return data[0]?.nom ?? null
}

interface BanFeature {
  geometry: { coordinates: [number, number] }
  properties: { label: string; context?: string }
}

// geocodage Geoplateforme (Base Adresse Nationale, successeur d'api-adresse.data.gouv.fr),
// communes seulement ; le departement vient du champ context "70, Haute-Saone, Bourgogne..."
export async function searchPlaces(q: string): Promise<GeoResult[]> {
  const res = await fetch('https://data.geopf.fr/geocodage/search?q=' + encodeURIComponent(q)
    + '&index=address&type=municipality&limit=20')
  if (!res.ok) throw new Error('geocodage http ' + res.status)
  const data = await res.json()
  return ((data.features || []) as BanFeature[])
    .map((f) => ({
      name: f.properties.label,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      area: (f.properties.context ?? '').split(', ')[1] ?? '',
    }))
    .filter((r) => inFranceBounds(r.lat, r.lon))
    .slice(0, 5)
}
