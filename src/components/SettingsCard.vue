<script setup lang="ts">
import { computed } from 'vue'
import { dest, reminderTime, setDest, setPlace, setReminderTime, setTripMin, swapPlaces, tripMin } from '../store'
import type { GeoResult } from '../lib/api'
import { distanceKm, estimatedTripMin, fmtMinutes, MAX_TRIP_MIN, routeLabel, TRIP_SPEED_KMH, type Place } from '../lib/meteo'
import { buildReminderIcs, downloadIcs, REMINDER_LEAD_MIN, reminderLabel as icsLabel } from '../lib/ics'
import { geolocSupported, useLocate } from '../lib/locate'
import PlaceSearch from './PlaceSearch.vue'

const props = defineProps<{ place: Place }>()
const emit = defineEmits<{ close: [] }>()

const { locating, message: geoMessage, locateMe, cancel } = useLocate()

const SHORT_TRIP_KM = 4

const tripHint = computed(() => {
  const d = dest.value
  if (!d) return null
  const km = distanceKm(props.place, d)
  const min = Math.max(5, estimatedTripMin(props.place, d))
  const base = 'À vol d\'oiseau ' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km, soit environ ' + fmtMinutes(min) + ' à ' + TRIP_SPEED_KMH + ' km/h.'
  if (min > MAX_TRIP_MIN) {
    return { text: base + ' Trop long pour une lecture sur le parcours : l\'app suppose que tu le fais en ' + fmtMinutes(MAX_TRIP_MIN) + ', fie-toi surtout au départ et à l\'arrivée.', warn: true }
  }
  if (km < SHORT_TRIP_KM) {
    return { text: base + ' Si près, l\'arrivée ne change rien au verdict : la pluie est connue à 2 km près.', warn: false }
  }
  return { text: base, warn: false }
})

function onTrip(e: Event): void {
  setTripMin(parseInt((e.target as HTMLInputElement).value, 10))
}

function onReminder(e: Event): void {
  setReminderTime((e.target as HTMLInputElement).value)
}

const reminderLabel = computed(() => icsLabel(reminderTime.value))

const label = computed(() => routeLabel(props.place, dest.value))

function addReminder(): void {
  const ics = buildReminderIcs(props.place, reminderTime.value, new Date(), dest.value)
  if (ics) downloadIcs(ics, 'pleutpas-rappel.ics')
}

function pickPlace(r: GeoResult): void {
  cancel()
  setPlace({ name: r.name, lat: r.lat, lon: r.lon })
}

function pickDest(r: GeoResult): void {
  setDest({ name: r.name, lat: r.lat, lon: r.lon })
}
</script>

<template>
  <section class="card">
    <h2 class="hdr !mb-1">Réglages</h2>
    <p class="mb-3 text-[13px] text-dim">Chaque changement s'applique tout de suite, le verdict se met à jour en dessous.</p>
    <label class="mb-2 block text-sm" for="tripRange">Durée du trajet : <b>{{ tripMin }} min</b></label>
    <input id="tripRange" type="range" class="w-full accent-legere" min="5" :max="MAX_TRIP_MIN" step="5" :value="tripMin" @input="onTrip">
    <p v-if="tripHint" class="mt-1 text-[13px]" :class="tripHint.warn ? 'text-amber-500' : 'text-dim'">{{ tripHint.text }}</p>
    <label class="mb-2 mt-4 block text-sm" for="placeInput">{{ dest ? 'Départ' : 'Lieu' }} : <b>{{ place.name }}</b></label>
    <PlaceSearch id="placeInput" :near="place" @pick="pickPlace">
      <template #aside>
        <button
          v-if="geolocSupported"
          class="inline-flex h-[46px] w-[46px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line bg-panel2 text-ink active:bg-line disabled:cursor-wait"
          :disabled="locating" :aria-label="locating ? 'Localisation en cours' : 'Utiliser ma position'" title="Utiliser ma position" @click="locateMe"
        >
          <span v-if="locating" class="block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-ink"></span>
          <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>
        </button>
      </template>
    </PlaceSearch>
    <div v-if="geoMessage" class="mt-2 text-[13px] text-dim">{{ geoMessage }}</div>
    <label class="mb-2 mt-4 block text-sm" for="destInput">Arrivée (facultatif) : <b>{{ dest ? dest.name : 'aucune' }}</b></label>
    <PlaceSearch id="destInput" :near="place" :clearable="dest !== null" @pick="pickDest" @clear="setDest(null)" />
    <button v-if="dest" class="mt-2 w-full cursor-pointer rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-sm active:bg-line" @click="swapPlaces">Inverser le sens</button>
    <p v-else class="mt-1.5 text-[13px] text-dim">Avec une arrivée, la pluie est lue tout le long du trajet, à l'heure où tu y passes.</p>
    <details class="group mt-4">
      <summary class="flex cursor-pointer select-none list-none items-center justify-between gap-2 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-sm active:bg-line [&::-webkit-details-marker]:hidden">
        <span>Rappel dans mon agenda <span class="text-dim">(facultatif)</span></span>
        <svg class="h-4 w-4 flex-none text-dim transition-transform group-open:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
      </summary>
      <label class="mb-2 mt-3 block text-sm" for="reminderTime">Heure de départ : <b>{{ reminderLabel }}</b></label>
      <div class="flex gap-2">
        <input
          id="reminderTime" type="time" :value="reminderTime" step="300"
          class="min-w-0 flex-1 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-[15px] text-ink"
          @change="onReminder"
        >
        <button class="flex-none cursor-pointer rounded-[10px] border border-line bg-panel2 px-3.5 py-2.5 text-sm active:bg-line" @click="addReminder">Ajouter à mon agenda</button>
      </div>
      <p class="mt-1.5 text-[13px] text-dim">Ton agenda te préviendra {{ REMINDER_LEAD_MIN }} min avant, du lundi au vendredi, et un tap ouvrira la météo de {{ label }}.</p>
    </details>
    <button type="button" class="mt-4 w-full cursor-pointer rounded-[10px] border border-legere/60 bg-panel2 px-3 py-3 text-[15px] font-semibold text-ink active:bg-line" @click="emit('close')">C'est bon</button>
  </section>
</template>
