<script setup lang="ts">
import { ref } from 'vue'
import { place, setPlace, setTripMin, tripMin } from '../store'
import { searchPlaces, type GeoResult } from '../lib/api'

const query = ref('')
const results = ref<GeoResult[]>([])
const message = ref('')

function onTrip(e: Event): void {
  setTripMin(parseInt((e.target as HTMLInputElement).value, 10))
}

async function search(): Promise<void> {
  const q = query.value.trim()
  if (q.length < 2) return
  message.value = 'Recherche...'
  results.value = []
  try {
    const found = await searchPlaces(q)
    results.value = found
    message.value = found.length ? '' : 'Aucun lieu trouvé pour "' + q + '".'
  } catch {
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
