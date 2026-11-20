<script setup lang="ts">
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { dest, futureRain, recenterTick, setDest } from '../store'
import { bearingDeg, fmtHM, FRANCE_BOUNDS, type Place } from '../lib/meteo'
import { rainLayer, type RainLayer } from '../lib/rainLayer'
import { loadFrameImage } from '../lib/api'
import { PICK_ZOOM, usePickOnMap } from '../lib/pickOnMap'
import { geolocSupported, getPosition, locateError } from '../lib/locate'
import MapPickBar from './MapPickBar.vue'

interface ViewFrame {
  time: number
  type: 'obs' | 'fcst'
  url: string
  bounds: [[number, number], [number, number]]
}

const props = defineProps<{ place: Place }>()

const { picking, resolving, pending: pickPending, name: pickName, outside, canStart, canDest, enter, cancel, useAsStart, useAsDest } = usePickOnMap()
let pickBtn: HTMLAnchorElement | null = null
let locateBtn: HTMLAnchorElement | null = null
let framed: { center: L.LatLng; zoom: number } | null = null
const FRAMED_TOLERANCE_PX = 3
const MAX_BOUNDS = L.latLngBounds(FRANCE_BOUNDS).pad(0.05)
const locating = ref(false)
let meMarker: L.CircleMarker | null = null
const mapMsg = ref('')
let msgTimer = 0
const MSG_MS = 6000
const PIN_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true">'
  + '<path d="M10 18.5c-3.3-4-5.5-7.1-5.5-10a5.5 5.5 0 0 1 11 0c0 2.9-2.2 6-5.5 10z"/><circle cx="10" cy="8.5" r="2"/></svg>'
const LOCATE_SVG = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'
  + '<circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>'

const mapEl = ref<HTMLDivElement | null>(null)
const frameIdx = ref(0)
const playing = ref(false)

let map: L.Map | null = null
let marker: L.CircleMarker | null = null
let destMarker: L.CircleMarker | null = null
let line: L.Polyline | null = null
let arrows: L.Marker[] = []
const ARROW_AT = [0.3, 0.7]
let layer: RainLayer | null = null
let layerBoundsKey = ''
let raf = 0
let head = 0
let headStart = 0
let drawKey = ''

const FRAME_MS = 150
const FADE_STEPS = 30
const FADE = (navigator.hardwareConcurrency || 8) > 4
const MAX_ZOOM = 14
const TRIP_ZOOM = 13
const POINT_ZOOM = 8
const LOOP_PAUSE_MS = 1200

const ready = new Map<string, HTMLImageElement>()
const pending = new Set<string>()
const failed = new Set<string>()

const frames = computed<ViewFrame[]>(() => {
  const fut = futureRain.value
  if (!fut) return []
  const obs = fut.past.map(f => ({ ...f, type: 'obs' as const }))
  const lastObs = obs.length ? obs[obs.length - 1].time : Date.now() / 1000
  return [
    ...obs,
    ...fut.frames.filter(f => f.time > lastObs).map(f => ({ ...f, type: 'fcst' as const })),
  ]
})
const current = computed(() => frames.value[frameIdx.value] ?? null)
const maxIdx = computed(() => Math.max(0, frames.value.length - 1))
const note = computed(() => {
  const fs = frames.value
  if (!fs.length) return 'Carte des pluies indisponible pour le moment, la timeline ci-dessus prend le relais.'
  const end = fmtHM(fs[fs.length - 1].time * 1000)
  return fs[0].type === 'obs'
    ? 'La pluie depuis ' + fmtHM(fs[0].time * 1000) + ', puis la prévision jusqu\'à ' + end + '.'
    : 'La pluie prévue jusqu\'à ' + end + '.'
})

function loadImage(url: string): void {
  if (ready.has(url) || pending.has(url) || failed.has(url)) return
  pending.add(url)
  loadFrameImage(url)
    .then((img) => { ready.set(url, img) }, () => { failed.add(url) })
    .finally(() => {
      pending.delete(url)
      if (!playing.value) paintStill(frameIdx.value)
    })
}

function setLayerBounds(f: ViewFrame): void {
  const key = f.bounds.join(',')
  if (key === layerBoundsKey || !layer) return
  layerBoundsKey = key
  layer.setBounds(L.latLngBounds(f.bounds))
}

function sameBounds(a: ViewFrame, b: ViewFrame): boolean {
  return a.bounds.join(',') === b.bounds.join(',')
}

function paintStill(i: number): void {
  const f = frames.value[i]
  if (!layer || !f) return
  loadImage(f.url)
  const img = ready.get(f.url)
  if (!img) return
  drawKey = i + ':still'
  setLayerBounds(f)
  layer.draw(img, null, 0)
}

function show(i: number): void {
  frameIdx.value = i
  head = i
  paintStill(i)
}

function tick(ts: number): void {
  if (!playing.value) return
  const fs = frames.value
  if (!fs.length) {
    stopPlay()
    return
  }
  if (head >= fs.length) head = 0
  const wasLast = head === fs.length - 1
  const nextIdx = wasLast ? 0 : head + 1
  const nextUrl = fs[nextIdx].url
  if (ts - headStart >= (wasLast ? LOOP_PAUSE_MS : FRAME_MS) && (ready.has(nextUrl) || failed.has(nextUrl))) {
    head = nextIdx
    headStart = ts
  }
  const cur = fs[head]
  const to = head < fs.length - 1 ? fs[head + 1] : null
  const curImg = ready.get(cur.url)
  const toImg = FADE && to && sameBounds(cur, to) ? ready.get(to.url) : undefined
  const mix = toImg ? Math.min(1, (ts - headStart) / FRAME_MS) : 0
  frameIdx.value = to && mix >= 0.5 ? head + 1 : head
  if (curImg && layer) {
    const key = head + ':' + (toImg ? Math.round(mix * FADE_STEPS) : 'hold')
    if (key !== drawKey) {
      drawKey = key
      setLayerBounds(cur)
      layer.draw(curImg, toImg ?? null, mix)
    }
  }
  raf = requestAnimationFrame(tick)
}

function preloadAll(): void {
  const fs = frames.value
  for (let k = 0; k < fs.length; k++) loadImage(fs[(head + k) % fs.length].url)
}

function stopPlay(): void {
  cancelAnimationFrame(raf)
  playing.value = false
}

function togglePlay(): void {
  if (playing.value) {
    stopPlay()
    show(frameIdx.value)
    return
  }
  if (!frames.value.length) return
  head = frameIdx.value
  headStart = performance.now()
  playing.value = true
  preloadAll()
  raf = requestAnimationFrame(tick)
}

function rebuild(): void {
  const fs = frames.value
  const keep = new Set(fs.map(f => f.url))
  for (const url of [...ready.keys()]) {
    if (!keep.has(url)) ready.delete(url)
  }
  failed.clear()
  drawKey = ''
  if (!fs.length) {
    stopPlay()
    frameIdx.value = 0
    layer?.clear()
    return
  }
  if (playing.value) {
    head = Math.min(head, fs.length - 1)
    preloadAll()
    return
  }
  const nowSec = Date.now() / 1000
  const nearestNow = fs.reduce(
    (best, f, i) => (Math.abs(f.time - nowSec) < Math.abs(fs[best].time - nowSec) ? i : best),
    0,
  )
  show(nearestNow)
}

function onSlide(e: Event): void {
  stopPlay()
  show(parseInt((e.target as HTMLInputElement).value, 10) || 0)
}

function onResize(): void {
  map?.invalidateSize()
}

function recenter(): void {
  if (!map) return
  const p = props.place
  const a: L.LatLngTuple = [p.lat, p.lon]
  marker?.setLatLng(a)
  const d = dest.value
  if (d && line && destMarker) {
    const b: L.LatLngTuple = [d.lat, d.lon]
    line.setLatLngs([a, b]).addTo(map)
    destMarker.setLatLng(b).addTo(map)
    const heading = bearingDeg(p, d)
    arrows.forEach((m, i) => {
      const f = ARROW_AT[i]
      m.setLatLng([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f])
      m.setIcon(arrowIcon(heading))
      m.addTo(map!)
    })
    if (!picking.value) map.fitBounds(L.latLngBounds([a, b]), { padding: [40, 40], maxZoom: TRIP_ZOOM, animate: false })
  } else {
    line?.remove()
    destMarker?.remove()
    arrows.forEach((m) => m.remove())
    if (!picking.value) map.setView(a, POINT_ZOOM, { animate: false })
  }
  if (!picking.value) {
    meMarker?.remove()
    map.panInsideBounds(MAX_BOUNDS, { animate: false })
  }
  framed = { center: map.getCenter(), zoom: map.getZoom() }
}

function viewMoved(): boolean {
  if (!map || !framed) return true
  if (map.getZoom() !== framed.zoom) return true
  return map.latLngToContainerPoint(framed.center).distanceTo(map.getSize().divideBy(2)) > FRAMED_TOLERANCE_PX
}

function showMsg(text: string): void {
  clearTimeout(msgTimer)
  mapMsg.value = text
  msgTimer = window.setTimeout(() => { mapMsg.value = '' }, MSG_MS)
}

async function locateOnMap(): Promise<void> {
  if (!map || locating.value) return
  locating.value = true
  try {
    const { lat, lon } = await getPosition()
    if (!map) return
    const here: L.LatLngTuple = [lat, lon]
    map.setView(here, Math.max(map.getZoom(), PICK_ZOOM), { animate: false })
    meMarker?.setLatLng(here).addTo(map)
  } catch (e) {
    showMsg(locateError(e))
  } finally {
    locating.value = false
  }
}

function togglePick(): void {
  if (!map) return
  if (picking.value) {
    onCancel()
    return
  }
  if (playing.value) togglePlay()
  enter(map, viewMoved() ? null : props.place)
  map.getContainer().focus({ preventScroll: true })
}

function onCancel(): void {
  cancel()
  recenter()
}

function controlButton(bar: HTMLElement, cls: string, label: string, svg: string, onClick: () => void): HTMLAnchorElement {
  const a = L.DomUtil.create('a', 'map-ctl ' + cls, bar) as HTMLAnchorElement
  a.href = '#'
  a.setAttribute('role', 'button')
  a.setAttribute('aria-label', label)
  a.title = label
  a.innerHTML = svg
  L.DomEvent.on(a, 'click', L.DomEvent.stop).on(a, 'click', onClick)
  return a
}

function mapControls(): L.Control {
  const ctl = new L.Control({ position: 'topright' })
  ctl.onAdd = () => {
    const bar = L.DomUtil.create('div', 'leaflet-bar')
    L.DomEvent.disableClickPropagation(bar)
    pickBtn = controlButton(bar, 'pick-place', 'Choisir un lieu sur la carte', PIN_SVG, togglePick)
    pickBtn.setAttribute('aria-pressed', 'false')
    if (geolocSupported) {
      locateBtn = controlButton(bar, 'locate-me', 'Centrer la carte sur ma position', LOCATE_SVG, () => { void locateOnMap() })
      locateBtn.setAttribute('aria-busy', 'false')
    }
    return bar
  }
  return ctl
}

function arrowIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: '<svg viewBox="0 0 18 18" width="18" height="18" style="transform: rotate(' + Math.round(heading) + 'deg)" aria-hidden="true">'
      + '<path d="M9 1.5 L16 16 L9 12 L2 16 Z" fill="#1d6ef2" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  })
}

onMounted(() => {
  if (!mapEl.value) return
  const here: L.LatLngTuple = [props.place.lat, props.place.lon]
  map = L.map(mapEl.value, {
    zoomControl: false,
    maxZoom: MAX_ZOOM,
    minZoom: 5,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 1,
  }).setView(here, POINT_ZOOM)
  L.control.zoom({ position: 'topright', zoomInTitle: 'Zoomer', zoomOutTitle: 'Dézoomer' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: MAX_ZOOM, attribution: '© OpenStreetMap | Météo-France',
  }).addTo(map)
  mapControls().addTo(map)
  meMarker = L.circleMarker([0, 0], {
    radius: 6, color: '#fff', weight: 2, fillColor: '#2bb673', fillOpacity: 1, interactive: false,
  })
  layer = rainLayer(FRANCE_BOUNDS, { opacity: 0.85, zIndex: 5 }).addTo(map)
  marker = L.circleMarker(here, {
    radius: 7, color: '#fff', weight: 2, fillColor: '#1d6ef2', fillOpacity: 1,
  }).addTo(map)
  destMarker = L.circleMarker([0, 0], {
    radius: 7, color: '#1d6ef2', weight: 3, fillColor: '#fff', fillOpacity: 1,
  })
  line = L.polyline([], { color: '#1d6ef2', weight: 3, dashArray: '6 6', opacity: 0.9 })
  arrows = ARROW_AT.map(() => L.marker([0, 0], { icon: arrowIcon(0), interactive: false, keyboard: false, zIndexOffset: 500 }))
  recenter()
  window.addEventListener('resize', onResize)
  rebuild()
})

watch(futureRain, rebuild)
watch(recenterTick, recenter)
watch(locating, (busy) => locateBtn?.setAttribute('aria-busy', String(busy)))
watch(picking, (on) => {
  pickBtn?.setAttribute('aria-pressed', String(on))
  if (!on) pickBtn?.focus({ preventScroll: true })
})

onBeforeUnmount(() => {
  stopPlay()
  window.removeEventListener('resize', onResize)
  map?.remove()
  map = null
  layer = null
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">Radar de précipitation</h2>
    <div class="relative">
      <div ref="mapEl" class="radar-map h-[340px] rounded-xl bg-night desk:h-[520px]"></div>
      <div
        v-if="current"
        class="pointer-events-none absolute left-2 top-2 z-[1000] rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
        :class="current.type === 'fcst' ? 'bg-legere text-[#06121f]' : 'bg-night/80 text-ink'"
      >
        {{ current.type === 'fcst' ? 'Prévision' : 'Radar' }} {{ fmtHM(current.time * 1000) }}
      </div>
      <div v-if="picking" class="pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full" aria-hidden="true">
        <svg class="h-10 w-10 overflow-visible drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" viewBox="0 0 20 20" fill="#1d6ef2" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"><path d="M10 20c-3.6-4.3-6-7.8-6-11.2a6 6 0 0 1 12 0C16 12.2 13.6 15.7 10 20z"/><circle cx="10" cy="8.6" r="2.2" fill="#fff" stroke="none"/></svg>
      </div>
    </div>
    <div v-if="mapMsg" class="mt-2 text-xs text-warn" role="alert">{{ mapMsg }}</div>
    <MapPickBar v-if="picking" :name="pickName" :resolving="resolving" :pending="pickPending !== null" :outside="outside" :can-start="canStart" :can-dest="canDest" :has-dest="!!dest" @start="useAsStart" @dest="useAsDest" @cancel="onCancel" @remove-dest="setDest(null)" />
    <template v-else>
      <div class="mt-2.5 flex items-center gap-2.5">
        <button class="iconbtn" :aria-label="playing ? 'Pause' : 'Lecture'" @click="togglePlay">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="playing ? 'M6 19h4V5H6v14zm8-14v14h4V5h-4z' : 'M8 5v14l11-7z'"/></svg>
        </button>
        <input
          type="range" class="flex-1 accent-legere" aria-label="Instant affiché sur la carte"
          :aria-valuetext="current ? (current.type === 'fcst' ? 'prévision ' : 'radar ') + fmtHM(current.time * 1000) : ''"
          min="0" :max="maxIdx" :value="frameIdx" @input="onSlide"
        >
        <div class="min-w-[88px] text-right text-sm tabular-nums">
          {{ current ? fmtHM(current.time * 1000) : '--h--' }}
          <span v-if="current?.type === 'fcst'" class="block text-[10px] text-accent">prévision</span>
        </div>
      </div>
      <div class="mt-2 text-xs text-dim">{{ note }} Avec l'épingle, choisis un lieu directement sur la carte.</div>
    </template>
  </section>
</template>
