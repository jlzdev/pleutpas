<script setup lang="ts">
import { ref } from 'vue'
import { place, setPlace, setTripMin, tripMin } from '../store'
import { reverseGeocodeName, searchPlaces, type GeoResult } from '../lib/api'
import { inFranceBounds } from '../lib/meteo'

const query = ref('')
const results = ref<GeoResult[]>([])
const message = ref('')
const geolocSupported = 'geolocation' in navigator
const locating = ref(false)

function locateMe(): void {
  if (locating.value) return
  locating.value = true
  message.value = 'Localisation...'
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = Math.round(pos.coords.latitude * 1000) / 1000
    const lon = Math.round(pos.coords.longitude * 1000) / 1000
    if (!inFranceBounds(lat, lon)) {
      locating.value = false
      message.value = 'Position hors de la zone couverte (France métropolitaine et abords).'
      return
    }
    let name: string | null = null
    try { name = await reverseGeocodeName(lat, lon) } catch { /* nom facultatif */ }
    locating.value = false
    message.value = ''
    results.value = []
    setPlace({ name: name ?? 'Ma position', lat, lon })
  }, err => {
    locating.value = false
    message.value = err.code === err.PERMISSION_DENIED
      ? 'Géolocalisation refusée (autorise-la dans le navigateur, et il faut du HTTPS).'
      : 'Position introuvable pour le moment.'
  }, { timeout: 10000, maximumAge: 60000 })
}

function onTrip(e: Event): void {
  setTripMin(parseInt((e.target as HTMLInputElement).value, 10))
}

let searchSeq = 0

async function search(): Promise<void> {
  const q = query.value.trim()
  if (q.length < 2) return
  const seq = ++searchSeq
  message.value = 'Recherche...'
  results.value = []
  try {
    const found = await searchPlaces(q)
    if (seq !== searchSeq) return
    results.value = found
    message.value = found.length ? '' : 'Aucun lieu trouvé pour "' + q + '" dans la zone couverte (France métropolitaine).'
  } catch {
    if (seq !== searchSeq) return
    message.value = 'Recherche indisponible, vérifie ta connexion.'
  }
}

function label(r: GeoResult): string {
  const region = [r.admin1, r.country].filter(Boolean).join(', ')
  return r.name + (region ? ' (' + region + ')' : '')
}

function pick(r: GeoResult): void {
  results.value = []
  query.value = ''
  message.value = ''
  setPlace({ name: r.name, lat: r.latitude, lon: r.longitude })
}
</script>

<template>
  <section class="card">
    <h2 class="hdr">Réglages</h2>
    <label class="mb-2 block text-sm" for="tripRange">Durée du trajet : <b>{{ tripMin }} min</b></label>
    <input id="tripRange" type="range" class="w-full accent-legere" min="5" max="60" step="5" :value="tripMin" @input="onTrip">
    <label class="mb-2 mt-4 block text-sm" for="placeInput">Lieu : <b>{{ place.name }}</b></label>
    <div class="flex gap-2">
      <input
        id="placeInput" v-model="query" type="search" placeholder="Chercher une ville..."
        class="min-w-0 flex-1 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-[15px] text-ink"
        @keydown.enter="search"
      >
      <button class="flex-none cursor-pointer rounded-[10px] border border-line bg-panel2 px-3.5 py-2.5 text-sm" @click="search">Chercher</button>
    </div>
    <button
      v-if="geolocSupported"
      class="mt-2 w-full cursor-pointer rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-sm active:bg-line"
      :disabled="locating" @click="locateMe"
    >{{ locating ? 'Localisation...' : 'Utiliser ma position' }}</button>
    <div class="mt-2 flex flex-col gap-1.5">
      <button
        v-for="r in results" :key="r.latitude + '/' + r.longitude"
        class="cursor-pointer rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-left text-sm active:bg-line"
        @click="pick(r)"
      >{{ label(r) }}</button>
      <div v-if="message" class="text-[13px] text-dim">{{ message }}</div>
    </div>
  </section>
</template>
