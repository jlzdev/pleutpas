<script setup lang="ts">
import * as L from 'leaflet'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basemap, futureRain, place, recenterTick, setBasemap } from '../store'
import { fmtHM, FRANCE_BOUNDS } from '../lib/meteo'
import { rainLayer, type RainLayer } from '../lib/rainLayer'

interface ViewFrame {
  time: number
  type: 'obs' | 'fcst'
  url: string
  bounds: [[number, number], [number, number]]
}

const mapEl = ref<HTMLDivElement | null>(null)
const frameIdx = ref(0)
const playing = ref(false)

let map: L.Map | null = null
let marker: L.CircleMarker | null = null
let layer: RainLayer | null = null
let layerBoundsKey = ''
let raf = 0
let head = 0
let headStart = 0
let drawKey = ''

const FRAME_MS = 150
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
    ? 'La pluie des 2 dernières heures, puis la prévision jusqu\'à ' + end + '.'
    : 'La pluie prévue jusqu\'à ' + end + '.'
})

function loadImage(url: string): void {
  if (ready.has(url) || pending.has(url) || failed.has(url)) return
  pending.add(url)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.src = url
  img.decode()
    .then(() => { ready.set(url, img) }, () => { failed.add(url) })
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
  const toImg = to && sameBounds(cur, to) ? ready.get(to.url) : undefined
  const mix = toImg ? Math.min(1, (ts - headStart) / FRAME_MS) : 0
  frameIdx.value = to && mix >= 0.5 ? head + 1 : head
  if (curImg && layer) {
    const key = head + ':' + (toImg ? Math.round(mix * 60) : 'hold')
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

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, {
    zoomControl: false,
    maxZoom: 12,
    minZoom: 5,
    maxBounds: L.latLngBounds(FRANCE_BOUNDS).pad(0.05),
    maxBoundsViscosity: 1,
  }).setView([place.value.lat, place.value.lon], 8)
  L.control.zoom({ position: 'topright' }).addTo(map)
  const plan = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12, attribution: '© OpenStreetMap | Météo-France',
  })
  const velo = L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', {
    maxZoom: 12, attribution: '<a href="https://www.cyclosm.org/">CyclOSM</a> | © OpenStreetMap | Météo-France',
  })
  ;(basemap.value === 'velo' ? velo : plan).addTo(map)
  L.control.layers({ 'Plan': plan, 'Vélo (CyclOSM)': velo }, undefined, { position: 'topright' }).addTo(map)
  map.on('baselayerchange', (e: L.LayersControlEvent) => setBasemap(e.layer === velo ? 'velo' : 'plan'))
  layer = rainLayer(FRANCE_BOUNDS, { opacity: 0.85, zIndex: 5 }).addTo(map)
  marker = L.circleMarker([place.value.lat, place.value.lon], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#1d6ef2', fillOpacity: 1,
  }).addTo(map)
  window.addEventListener('resize', onResize)
  rebuild()
})

watch(futureRain, rebuild)
watch(recenterTick, () => {
  map?.setView([place.value.lat, place.value.lon], 8)
  marker?.setLatLng([place.value.lat, place.value.lon])
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
      <div ref="mapEl" class="radar-map h-[340px] rounded-xl bg-[#0a0f18] desk:h-[520px]"></div>
      <div
        v-if="current"
        class="pointer-events-none absolute left-2 top-2 z-[1000] rounded-lg px-2.5 py-1 text-xs font-bold transition-colors"
        :class="current.type === 'fcst' ? 'bg-legere text-[#06121f]' : 'bg-[#0a0f18]/75 text-dim'"
      >
        {{ current.type === 'fcst' ? 'Prévision' : 'Radar' }} {{ fmtHM(current.time * 1000) }}
      </div>
    </div>
    <div class="mt-2.5 flex items-center gap-2.5">
      <button class="iconbtn" :aria-label="playing ? 'Pause' : 'Lecture'" @click="togglePlay">
        <span v-if="playing">❚❚</span><span v-else>▶&#xFE0E;</span>
      </button>
      <input
        type="range" class="flex-1 accent-legere"
        min="0" :max="maxIdx" :value="frameIdx" @input="onSlide"
      >
      <div class="min-w-[88px] text-right text-sm tabular-nums">
        {{ current ? fmtHM(current.time * 1000) : '--h--' }}
        <span v-if="current?.type === 'fcst'" class="block text-[10px] text-bruine">prévision</span>
      </div>
    </div>
    <div class="mt-2 text-xs text-dim">{{ note }}</div>
  </section>
</template>
