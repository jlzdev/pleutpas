<script setup lang="ts">
import { setPlace } from '../store'
import { geolocSupported, useLocate } from '../lib/locate'
import type { GeoResult } from '../lib/api'
import PlaceSearch from './PlaceSearch.vue'

const { locating, message, locateMe, cancel } = useLocate()

const EXAMPLES = [
  { name: 'Paris', lat: 48.8566, lon: 2.3522 },
  { name: 'Strasbourg', lat: 48.5734, lon: 7.7521 },
  { name: 'Grenoble', lat: 45.1885, lon: 5.7245 },
  { name: 'Nantes', lat: 47.2184, lon: -1.5536 },
  { name: 'Bordeaux', lat: 44.8378, lon: -0.5792 },
]

const FEATURES = [
  {
    title: 'Un verdict, OUI ou PLUIE',
    text: 'selon la pluie attendue sur la durée de ton trajet, et sinon le prochain départ au sec.',
    icon: 'M4 10.5l4 4 8-9',
  },
  {
    title: 'Les 2 prochaines heures',
    text: 'minute par minute avec le radar Météo-France, puis la suite de la journée heure par heure.',
    icon: 'M10 5v5l3 2M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  },
  {
    title: 'La pluie animée sur la carte',
    text: 'la dernière heure observée, puis la prévision jusqu\'à 3 h, autour de chez toi.',
    icon: 'M6 14a4 4 0 0 1-.5-8A5 5 0 0 1 15 7.5 3.5 3.5 0 0 1 14.5 14zM7 16.5l-1 2M11 16.5l-1 2M15 16.5l-1 2',
  },
]

function choose(p: { name: string; lat: number; lon: number }): void {
  cancel()
  setPlace({ name: p.name, lat: p.lat, lon: p.lon })
}

function pickPlace(r: GeoResult): void {
  choose(r)
}
</script>

<template>
  <section class="card">
    <h2 class="hdr">Où pars-tu ?</h2>
    <p class="text-[15px] leading-5 text-ink [text-wrap:pretty]">Pleut pas ? te dit en un coup d'oeil si tu peux partir sans te faire tremper, et sinon à quelle heure.</p>
    <ul class="mt-3 grid gap-2 desk:grid-cols-3">
      <li v-for="f in FEATURES" :key="f.title" class="flex items-start gap-2.5 rounded-[10px] bg-panel2 px-3 py-2.5">
        <svg class="mt-0.5 h-5 w-5 flex-none text-legere" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="f.icon"/></svg>
        <p class="text-[13px] leading-[18px] text-dim [text-wrap:pretty]"><span class="font-semibold text-ink">{{ f.title }}</span>, {{ f.text }}</p>
      </li>
    </ul>
    <button
      v-if="geolocSupported"
      class="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-legere/60 bg-panel2 px-3 py-3 text-[15px] font-semibold text-ink active:bg-line disabled:cursor-wait"
      :disabled="locating" @click="locateMe"
    >
      <span v-if="locating" class="block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink"></span>
      <svg v-else class="h-5 w-5 text-legere" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>
      Utiliser ma position
    </button>
    <div v-if="message" class="mt-2 text-[13px] text-dim">{{ message }}</div>
    <label class="mb-2 mt-4 block text-sm" for="welcomePlace">{{ geolocSupported ? 'Ou cherche ta ville, ou ta rue et ta ville' : 'Cherche ta ville, ou ta rue et ta ville' }}</label>
    <PlaceSearch id="welcomePlace" @pick="pickPlace" />
    <div class="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-dim">
      <span>Ou essaie avec</span>
      <button
        v-for="e in EXAMPLES" :key="e.name"
        class="cursor-pointer rounded-full border border-line bg-panel px-3 py-1 text-[13px] font-semibold text-ink active:bg-panel2"
        @click="choose(e)"
      >{{ e.name }}</button>
    </div>
    <p class="mt-4 text-xs leading-4 text-dim [text-wrap:pretty]">France métropolitaine et pays voisins. Sans compte ni inscription : le lieu reste sur cet appareil, modifiable à tout moment dans les réglages ou avec l'épingle sur la carte.</p>
  </section>
</template>
