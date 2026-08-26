<script setup lang="ts">
import * as L from 'leaflet'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { futureRain, place, radarError, radarMaps, recenterTick } from '../store'
import { fmtHM } from '../lib/meteo'

interface ViewFrame {
  time: number
  type: 'obs' | 'fcst'
  path?: string
  url?: string
}

const mapEl = ref<HTMLDivElement | null>(null)
const frameIdx = ref(0)
const playing = ref(false)

let map: L.Map | null = null
let marker: L.CircleMarker | null = null
let layers: (L.TileLayer | L.ImageOverlay)[] = []
let added: boolean[] = []
let timer: ReturnType<typeof setInterval> | null = null

const frames = computed<ViewFrame[]>(() => {
  const rv = radarMaps.value?.frames ?? []
  const fut = futureRain.value
  if (!fut) return rv.map(f => ({ time: f.time, type: f.type, path: f.path }))
  const obs = rv.filter(f => f.type === 'obs')
  const lastObs = obs.length ? obs[obs.length - 1].time : Date.now() / 1000
  return [
    ...obs.map(f => ({ time: f.time, type: f.type, path: f.path })),
    ...fut.frames.filter(f => f.time > lastObs).map(f => ({ time: f.time, type: 'fcst' as const, url: f.url })),
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
  const host = radarMaps.value?.host
  const fut = futureRain.value
  // grille de tuiles gratuite RainViewer limitee a z=7, atteinte au zoom carte 8 via les tuiles 512px
  layers = frames.value.map(f => f.path && host
    ? L.tileLayer(
        host + f.path + '/512/{z}/{x}/{y}/2/1_1.png',
        { opacity: 0, tileSize: 512, zoomOffset: -1, maxNativeZoom: 8, maxZoom: 12, zIndex: 5 },
      )
    : L.imageOverlay(f.url ?? '', fut?.bounds ?? [[41, -5.5], [51.5, 10]], { opacity: 0, zIndex: 5 }))
  added = frames.value.map(() => false)
  if (!frames.value.length) return
  const lastObs = frames.value.reduce((a, f, i) => (f.type === 'obs' ? i : a), 0)
  showFrame(lastObs)
}

function stopPlay(): void {
  if (timer) clearInterval(timer)
  timer = null
  playing.value = false
}

function togglePlay(): void {
  if (playing.value) {
    stopPlay()
    return
  }
  if (!frames.value.length) return
  playing.value = true
  timer = setInterval(() => {
    showFrame((frameIdx.value + 1) % frames.value.length)
  }, 650)
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
    <div ref="mapEl" class="h-[340px] rounded-xl bg-[#0a0f18] desk:h-[520px]"></div>
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
