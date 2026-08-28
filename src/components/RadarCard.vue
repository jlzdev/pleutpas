<script setup lang="ts">
import * as L from 'leaflet'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { futureRain, place, recenterTick } from '../store'
import { fmtHM, FRANCE_BOUNDS } from '../lib/meteo'

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
let layers: L.ImageOverlay[] = []
let added: boolean[] = []
let timer: ReturnType<typeof setTimeout> | null = null

const FRAME_MS = 300
const LOOP_PAUSE_MS = 1400

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

function showFrame(i: number): void {
  frameIdx.value = i
  if (!map || !layers[i]) return
  if (!added[i]) {
    layers[i].addTo(map)
    added[i] = true
  }
  layers.forEach((l, j) => l.setOpacity(j === i ? 0.85 : 0))
}

function rebuildLayers(): void {
  if (!map) return
  layers.forEach(l => map!.removeLayer(l))
  layers = frames.value.map(f => L.imageOverlay(f.url, f.bounds, { opacity: 0, zIndex: 5 }))
  added = frames.value.map(() => false)
  if (!frames.value.length) {
    stopPlay()
    frameIdx.value = 0
    return
  }
  const nowSec = Date.now() / 1000
  const nearestNow = frames.value.reduce(
    (best, f, i) => (Math.abs(f.time - nowSec) < Math.abs(frames.value[best].time - nowSec) ? i : best),
    0,
  )
  showFrame(nearestNow)
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
  map = L.map(mapEl.value, {
    zoomControl: false,
    maxZoom: 12,
    minZoom: 5,
    maxBounds: L.latLngBounds(FRANCE_BOUNDS).pad(0.05),
    maxBoundsViscosity: 1,
  }).setView([place.value.lat, place.value.lon], 8)
  L.control.zoom({ position: 'topright' }).addTo(map)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 12, attribution: '© OpenStreetMap | Météo-France',
  }).addTo(map)
  marker = L.circleMarker([place.value.lat, place.value.lon], {
    radius: 7, color: '#fff', weight: 2, fillColor: '#1d6ef2', fillOpacity: 1,
  }).addTo(map)
  window.addEventListener('resize', onResize)
  rebuildLayers()
})

watch(futureRain, rebuildLayers)
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
        {{ current ? fmtHM(current.time * 1000) : '--h--' }}
        <span v-if="current?.type === 'fcst'" class="block text-[10px] text-bruine">prévision</span>
      </div>
    </div>
    <div class="mt-2 text-xs text-dim">{{ note }}</div>
  </section>
</template>
