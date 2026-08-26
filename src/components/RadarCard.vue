<script setup lang="ts">
import * as L from 'leaflet'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { futureRain, place, radarError, radarMaps, recenterTick } from '../store'
import { fmtHM } from '../lib/meteo'

type ViewFrame =
  | { time: number; type: 'obs' | 'fcst'; kind: 'tile'; url: string }
  | { time: number; type: 'fcst'; kind: 'image'; url: string; bounds: [[number, number], [number, number]] }

const mapEl = ref<HTMLDivElement | null>(null)
const frameIdx = ref(0)
const playing = ref(false)

let map: L.Map | null = null
let marker: L.CircleMarker | null = null
let layers: (L.TileLayer | L.ImageOverlay)[] = []
let added: boolean[] = []
let timer: ReturnType<typeof setTimeout> | null = null

const FRAME_MS = 300
const LOOP_PAUSE_MS = 1400

const frames = computed<ViewFrame[]>(() => {
  const maps = radarMaps.value
  // grille de tuiles gratuite RainViewer limitee a z=7, atteinte au zoom carte 8 via les tuiles 512px
  const tiles: ViewFrame[] = (maps?.frames ?? []).map(f => ({
    time: f.time,
    type: f.type,
    kind: 'tile' as const,
    url: maps!.host + f.path + '/512/{z}/{x}/{y}/2/1_1.png',
  }))
  const fut = futureRain.value
  if (!fut) return tiles
  const obs = tiles.filter(f => f.type === 'obs')
  const lastObs = obs.length ? obs[obs.length - 1].time : Date.now() / 1000
  return [
    ...obs,
    ...fut.frames.filter(f => f.time > lastObs).map(f => ({
      time: f.time,
      type: 'fcst' as const,
      kind: 'image' as const,
      url: f.url,
      bounds: fut.bounds,
    })),
  ]
})
const current = computed(() => frames.value[frameIdx.value] ?? null)
const maxIdx = computed(() => Math.max(0, frames.value.length - 1))
const note = computed(() => {
  const fut = futureRain.value
  const arome = fut ? 'prévision Météo-France (AROME, run de ' + fmtHM(Date.parse(fut.run)) + ')' : ''
  if (radarError.value) {
    return fut
      ? 'Radar injoignable pour le moment, ' + arome + ' seule.'
      : 'Radar injoignable pour le moment.'
  }
  if (!frames.value.length) return ''
  if (fut) return 'Images radar des 2 dernières heures + ' + arome + ' jusqu\'à +6 h.'
  return frames.value.some(f => f.type === 'fcst')
    ? 'Images radar des 2 dernières heures + prévision courte (déplacement des nuages).'
    : 'Images radar des 2 dernières heures. Prévision radar indisponible pour le moment, la timeline ci-dessus prend le relais.'
})

function showFrame(i: number): void {
  frameIdx.value = i
  if (!map || !layers[i]) return
  if (!added[i]) {
    layers[i].addTo(map)
    added[i] = true
  }
  layers.forEach((l, j) => l.setOpacity(j === i ? 0.7 : 0))
}

function rebuildLayers(): void {
  if (!map) return
  layers.forEach(l => map!.removeLayer(l))
  layers = frames.value.map(f => f.kind === 'tile'
    ? L.tileLayer(f.url, { opacity: 0, tileSize: 512, zoomOffset: -1, maxNativeZoom: 8, maxZoom: 12, zIndex: 5 })
    : L.imageOverlay(f.url, f.bounds, { opacity: 0, zIndex: 5 }))
  added = frames.value.map(() => false)
  if (!frames.value.length) {
    stopPlay()
    frameIdx.value = 0
    return
  }
  const lastObs = frames.value.reduce((a, f, i) => (f.type === 'obs' ? i : a), 0)
  showFrame(lastObs)
}

function stopPlay(): void {
  if (timer) clearTimeout(timer)
  timer = null
  playing.value = false
}

function preloadLayers(): void {
  if (!map) return
  layers.forEach((l, i) => {
    if (!added[i]) {
      l.addTo(map!)
      l.setOpacity(0)
      added[i] = true
    }
  })
}

function scheduleNext(): void {
  timer = setTimeout(() => {
    if (!playing.value) return
    if (!frames.value.length) {
      stopPlay()
      return
    }
    showFrame((frameIdx.value + 1) % frames.value.length)
    scheduleNext()
  }, frameIdx.value >= maxIdx.value ? LOOP_PAUSE_MS : FRAME_MS)
}

function togglePlay(): void {
  if (playing.value) {
    stopPlay()
    return
  }
  if (!frames.value.length) return
  playing.value = true
  preloadLayers()
  scheduleNext()
}

function onSlide(e: Event): void {
  stopPlay()
  showFrame(parseInt((e.target as HTMLInputElement).value, 10) || 0)
}

function onResize(): void {
  map?.invalidateSize()
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value, { zoomControl: false, maxZoom: 12, minZoom: 4 })
    .setView([place.value.lat, place.value.lon], 8)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12, attribution: '© OpenStreetMap | RainViewer | Météo-France',
  }).addTo(map)
  marker = L.circleMarker([place.value.lat, place.value.lon], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#1d6ef2', fillOpacity: 1,
  }).addTo(map)
  window.addEventListener('resize', onResize)
  rebuildLayers()
})

watch([radarMaps, futureRain], rebuildLayers)
watch(recenterTick, () => {
  map?.setView([place.value.lat, place.value.lon], 8)
  marker?.setLatLng([place.value.lat, place.value.lon])
})

onBeforeUnmount(() => {
  stopPlay()
  window.removeEventListener('resize', onResize)
  map?.remove()
  map = null
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
        {{ current ? fmtHM(current.time * 1000) : '--:--' }}
        <span v-if="current?.type === 'fcst'" class="block text-[10px] text-bruine">prévision</span>
      </div>
    </div>
    <div class="mt-2 text-xs text-dim">{{ note }}</div>
  </section>
</template>
