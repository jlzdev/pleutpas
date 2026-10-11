import palette from './palette.json'
import { cleanName, FRANCE_BOUNDS, inFranceBounds, type MfEntry, type Place } from './meteo'

export interface OpenMeteoPayload {
  timezone?: string
  minutely_15: {
    time: number[]
    precipitation: (number | null)[]
    temperature_2m?: (number | null)[]
    apparent_temperature?: (number | null)[]
    wind_speed_10m?: (number | null)[]
    wind_direction_10m?: (number | null)[]
    wind_gusts_10m?: (number | null)[]
  }
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
  kind: 'town' | 'address'
}

export interface GeoNear {
  lat: number
  lon: number
}

// endpoint de l'app mobile Meteo-France, token public partage (non officiel, peut casser sans preavis)
const MF_TOKEN = '__Wj7dVSTjV9YGu1guveLyDq0g7S7TfTjaHBTPTpO0kj8__'

export async function fetchWeather(places: Place[]): Promise<OpenMeteoPayload[]> {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + places.map((p) => p.lat).join(',') + '&longitude=' + places.map((p) => p.lon).join(',')
    + '&minutely_15=precipitation,temperature_2m,apparent_temperature,wind_speed_10m,wind_direction_10m,wind_gusts_10m'
    + '&hourly=precipitation,precipitation_probability'
    + '&forecast_days=2&timezone=auto&timeformat=unixtime'
  const res = await fetch(url)
  if (!res.ok) throw new Error('open-meteo http ' + res.status)
  const data = await res.json()
  // Open-Meteo renvoie un objet pour un lieu et une liste au-dela
  const list: OpenMeteoPayload[] = Array.isArray(data) ? data : [data]
  if (list.length !== places.length) throw new Error('open-meteo : ' + list.length + ' lieux au lieu de ' + places.length)
  return list
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

const frameImages = new Map<string, Promise<HTMLImageElement>>()

// Image + decode (et non createImageBitmap) : le navigateur partage alors l'image decodee
// avec la carte au lieu de la decoder deux fois
export function loadFrameImage(url: string): Promise<HTMLImageElement> {
  let p = frameImages.get(url)
  if (!p) {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = url
    p = img.decode().then(() => img)
    p.catch(() => frameImages.delete(url))
    frameImages.set(url, p)
  }
  return p
}

export function forgetFrameImages(keep: Set<string>): void {
  for (const url of [...frameImages.keys()]) {
    if (!keep.has(url)) frameImages.delete(url)
  }
}

// frames lame d'eau des branches piaf / data : lignes reechantillonnees en Mercator, un pixel
// opaque = une couleur exacte de la palette ; fenetre 3x3 px (~5 km) par point, null hors frame
export async function sampleFramePoints(frame: FutureFrame, points: Place[]): Promise<(number | null)[]> {
  const [[south, west], [north, east]] = frame.bounds
  const img = await loadFrameImage(frame.url)
  const w = img.naturalWidth
  const h = img.naturalHeight
  const px = points.map(({ lat, lon }) => {
    if (lat <= south || lat >= north || lon <= west || lon >= east) return null
    return {
      x: Math.floor(((lon - west) / (east - west)) * w),
      y: Math.floor(((merc(north) - merc(lat)) / (merc(north) - merc(south))) * h),
    }
  })
  const inside = px.filter((q): q is { x: number; y: number } => q !== null)
  if (!inside.length) return px.map(() => null)
  const x0 = Math.max(0, Math.min(...inside.map((q) => q.x)) - 1)
  const y0 = Math.max(0, Math.min(...inside.map((q) => q.y)) - 1)
  const x1 = Math.min(w - 1, Math.max(...inside.map((q) => q.x)) + 1)
  const y1 = Math.min(h - 1, Math.max(...inside.map((q) => q.y)) + 1)
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const cv = document.createElement('canvas')
  cv.width = cw
  cv.height = ch
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('canvas 2d indisponible')
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, cw, ch)
  const data = ctx.getImageData(0, 0, cw, ch).data
  return px.map((q) => {
    if (!q) return null
    let max = 0
    for (let y = Math.max(0, q.y - 1); y <= Math.min(h - 1, q.y + 1); y++) {
      for (let x = Math.max(0, q.x - 1); x <= Math.min(w - 1, q.x + 1); x++) {
        const i = ((y - y0) * cw + (x - x0)) * 4
        if (data[i + 3] !== 255) continue
        const step = STEP_COLORS.find((c) => c.rgb[0] === data[i] && c.rgb[1] === data[i + 1] && c.rgb[2] === data[i + 2])
        if (step && step.mm > max) max = step.mm
      }
    }
    return max
  })
}

const PHOTON = 'https://photon.komoot.io'
// un geocodeur qui traine ne doit pas retenir les resultats de l'autre : 6 s au plus,
// et 1,5 s de grace une fois que le premier a repondu
const GEO_TIMEOUT_MS = 6000
const GEO_GRACE_MS = 1500
function geoSignal(signal?: AbortSignal): AbortSignal {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(new DOMException('geocodeur trop lent', 'TimeoutError')), GEO_TIMEOUT_MS)
  ctl.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  if (signal?.aborted) ctl.abort(signal.reason)
  else signal?.addEventListener('abort', () => ctl.abort(signal.reason), { once: true })
  return ctl.signal
}

const geoFetch = (url: string, signal?: AbortSignal) => fetch(url, { signal: geoSignal(signal) })

function nearParams(near?: GeoNear): string {
  return near ? '&lat=' + near.lat + '&lon=' + near.lon : ''
}

async function settleWithGrace<T>(ps: Promise<T>[], graceMs: number): Promise<PromiseSettledResult<T>[]> {
  const wrapped = ps.map((p): Promise<PromiseSettledResult<T>> => p.then(
    (value) => ({ status: 'fulfilled', value }),
    (reason) => ({ status: 'rejected', reason }),
  ))
  await Promise.race(wrapped)
  const late = new Promise<PromiseSettledResult<T>>((resolve) =>
    setTimeout(() => resolve({ status: 'rejected', reason: new Error('geocodeur trop lent') }), graceMs))
  return Promise.all(wrapped.map((w) => Promise.race([w, late])))
}
const PHOTON_BBOX = [FRANCE_BOUNDS[0][1], FRANCE_BOUNDS[0][0], FRANCE_BOUNDS[1][1], FRANCE_BOUNDS[1][0]].join(',')

interface PhotonFeature {
  geometry: { coordinates: [number, number] }
  properties: { name?: string; city?: string; county?: string; country?: string; countrycode?: string }
}

type PhotonResult = GeoResult & { fr: boolean }

// commune contenant le point (API Decoupage administratif, polygone), fiable meme en
// pleine campagne la ou le geocodage inverse par adresse ne renvoie rien
async function communeName(lat: number, lon: number): Promise<string | null> {
  const res = await geoFetch('https://geo.api.gouv.fr/communes?lat=' + lat + '&lon=' + lon + '&fields=nom')
  if (!res.ok) throw new Error('communes http ' + res.status)
  const data: { nom?: string }[] = await res.json()
  return data[0]?.nom ?? null
}

async function photonName(lat: number, lon: number): Promise<string | null> {
  const res = await geoFetch(PHOTON + '/reverse?lat=' + lat + '&lon=' + lon + '&lang=fr')
  if (!res.ok) throw new Error('photon http ' + res.status)
  const data = await res.json()
  const p = ((data.features || []) as PhotonFeature[])[0]?.properties
  return cleanName(p?.city ?? p?.name) || null
}

const ADDRESS_MAX_M = 200

function addressLabel(street: string, city: string): string {
  return cleanName(street.charAt(0).toUpperCase() + street.slice(1) + ', ' + city)
}

async function banAddressName(lat: number, lon: number): Promise<string | null> {
  const res = await geoFetch('https://data.geopf.fr/geocodage/reverse?index=address&limit=1&lat=' + lat + '&lon=' + lon)
  if (!res.ok) throw new Error('geocodage inverse http ' + res.status)
  const data = await res.json()
  const p = ((data.features || []) as BanFeature[])[0]?.properties
  if (!p || !p.name || !p.city || p.type === 'municipality') return null
  if (typeof p.distance !== 'number' || p.distance > ADDRESS_MAX_M) return null
  return addressLabel(p.name, p.city) || null
}

export async function reverseGeocodeName(lat: number, lon: number): Promise<string | null> {
  const address = await banAddressName(lat, lon).catch(() => null)
  if (address) return address
  const name = await communeName(lat, lon).catch(() => null)
  return name ?? photonName(lat, lon)
}

interface BanFeature {
  geometry: { coordinates: [number, number] }
  properties: { label: string; context?: string; type?: string; name?: string; city?: string; distance?: number }
}

// geocodage Geoplateforme (Base Adresse Nationale, successeur d'api-adresse.data.gouv.fr),
// communes seulement ; le departement vient du champ context "70, Haute-Saone, Bourgogne..."
const BAN = 'https://data.geopf.fr/geocodage/search?index=address&limit=20&q='

function banArea(f: BanFeature): string {
  return (f.properties.context ?? '').split(', ')[1] ?? ''
}

async function searchBan(q: string, near?: GeoNear, signal?: AbortSignal): Promise<GeoResult[]> {
  const res = await geoFetch(BAN + encodeURIComponent(q) + '&type=municipality' + nearParams(near), signal)
  if (!res.ok) throw new Error('geocodage http ' + res.status)
  const data = await res.json()
  return ((data.features || []) as BanFeature[]).map((f) => ({
    name: cleanName(f.properties.label),
    lon: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    area: banArea(f),
    kind: 'town' as const,
  }))
}

async function searchBanAddresses(q: string, near?: GeoNear, signal?: AbortSignal): Promise<GeoResult[]> {
  const res = await geoFetch(BAN + encodeURIComponent(q) + nearParams(near), signal)
  if (!res.ok) throw new Error('geocodage http ' + res.status)
  const data = await res.json()
  return ((data.features || []) as BanFeature[])
    .filter((f) => f.properties.type !== 'municipality' && f.properties.city)
    .map((f) => {
      return {
        name: addressLabel(f.properties.name ?? '', f.properties.city ?? ''),
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        area: banArea(f),
        kind: 'address' as const,
      }
    })
}

async function searchPhoton(q: string, near?: GeoNear, signal?: AbortSignal): Promise<PhotonResult[]> {
  const res = await geoFetch(PHOTON + '/api/?q=' + encodeURIComponent(q)
    + '&lang=fr&limit=10&layer=city&bbox=' + PHOTON_BBOX + nearParams(near), signal)
  if (!res.ok) throw new Error('photon http ' + res.status)
  const data = await res.json()
  const seen = new Set<string>()
  const out: PhotonResult[] = []
  for (const f of (data.features || []) as PhotonFeature[]) {
    const fr = f.properties.countrycode === 'FR'
    const name = cleanName(f.properties.name)
    const area = cleanName(fr ? f.properties.county : f.properties.country)
    if (!name || seen.has(name + '|' + area)) continue
    seen.add(name + '|' + area)
    out.push({ name, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1], area, kind: 'town', fr })
  }
  return out
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// la BAN complete par prefixe jusqu'a 20 communes : sans priorite au nom exact, "Gand"
// (Belgique) serait chasse des 5 places par Gandrange, Gandelu...
export async function searchPlaces(q: string, near?: GeoNear, signal?: AbortSignal): Promise<GeoResult[]> {
  const [ban, photon, addr] = await settleWithGrace<GeoResult[] | PhotonResult[]>([
    searchBan(q, near, signal),
    searchPhoton(q, near, signal),
    searchBanAddresses(q, near, signal),
  ], GEO_GRACE_MS)
  if (signal?.aborted) throw new DOMException('recherche annulee', 'AbortError')
  if (ban.status === 'rejected' && photon.status === 'rejected') throw ban.reason
  const inZone = (r: GeoResult) => r.name && inFranceBounds(r.lat, r.lon)
  const banList = (ban.status === 'fulfilled' ? ban.value as GeoResult[] : []).filter(inZone)
  const photonList = (photon.status === 'fulfilled' ? photon.value as PhotonResult[] : [])
    .filter((r) => ban.status === 'rejected' || !r.fr)
    .map(({ name, lat, lon, area, kind }) => ({ name, lat, lon, area, kind }))
    .filter(inZone)
  const addrList = (addr.status === 'fulfilled' ? addr.value as GeoResult[] : []).filter(inZone)
  // communes au nom exact, communes BAN, adresses BAN, puis communes voisines Photon
  const wanted = fold(q.trim())
  const exact = [...banList, ...photonList].filter((r) => fold(r.name) === wanted)
  const rest = [...banList, ...addrList, ...photonList].filter((r) => !exact.includes(r))
  return [...exact, ...rest].slice(0, 5)
}
