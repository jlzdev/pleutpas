<script setup lang="ts">
import { setPlace } from '../store'
import { geolocSupported, useLocate } from '../lib/locate'
import type { GeoResult } from '../lib/api'
import PlaceSearch from './PlaceSearch.vue'

const { locating, message, locateMe, cancel } = useLocate()

function pickPlace(r: GeoResult): void {
  cancel()
  setPlace({ name: r.name, lat: r.lat, lon: r.lon })
}
</script>

<template>
  <section class="card">
    <h2 class="hdr">Où pars-tu ?</h2>
    <p class="text-sm text-dim">Indique ton lieu de départ pour savoir s'il va pleuvoir sur ton trajet. Il est mémorisé sur cet appareil, et modifiable à tout moment dans les réglages.</p>
    <button
      v-if="geolocSupported"
      class="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[10px] border border-line bg-panel2 px-3 py-3 text-[15px] font-semibold text-ink active:bg-line disabled:cursor-wait"
      :disabled="locating" @click="locateMe"
    >
      <span v-if="locating" class="block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink"></span>
      <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>
      Utiliser ma position
    </button>
    <div v-if="message" class="mt-2 text-[13px] text-dim">{{ message }}</div>
    <label class="mb-2 mt-4 block text-sm" for="welcomePlace">{{ geolocSupported ? 'Ou cherche ta ville, ou ta rue et ta ville' : 'Cherche ta ville, ou ta rue et ta ville' }}</label>
    <PlaceSearch id="welcomePlace" @pick="pickPlace" />
  </section>
</template>
