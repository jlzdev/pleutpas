<script setup lang="ts">
import { computed, ref } from 'vue'
import { dest, place, reminderTime, setDest, setPlace, setReminderTime, setTripMin, swapPlaces, tripMin } from '../store'
import { reverseGeocodeName, type GeoResult } from '../lib/api'
import { distanceKm, estimatedTripMin, fmtMinutes, inFranceBounds, MAX_TRIP_MIN, routeLabel, TRIP_SPEED_KMH } from '../lib/meteo'
import { buildReminderIcs, downloadIcs, REMINDER_LEAD_MIN, reminderLabel as icsLabel } from '../lib/ics'
import PlaceSearch from './PlaceSearch.vue'

const emit = defineEmits<{ close: [] }>()

const geoMessage = ref('')
const geolocSupported = 'geolocation' in navigator
const locating = ref(false)

const SHORT_TRIP_KM = 4

const tripHint = computed(() => {
  const d = dest.value
  if (!d) return null
  const km = distanceKm(place.value, d)
  const min = Math.max(5, estimatedTripMin(place.value, d))
  const base = 'À vol d\'oiseau ' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km, soit environ ' + fmtMinutes(min) + ' à ' + TRIP_SPEED_KMH + ' km/h.'
  if (min > MAX_TRIP_MIN) {
    return { text: base + ' Trop long pour une lecture sur le parcours : l\'app suppose que tu le fais en ' + fmtMinutes(MAX_TRIP_MIN) + ', fie-toi surtout au départ et à l\'arrivée.', warn: true }
  }
  if (km < SHORT_TRIP_KM) {
    return { text: base + ' Si près, l\'arrivée ne change rien au verdict : la pluie est connue à 2 km près.', warn: false }
  }
  return { text: base, warn: false }
})

function locateMe(): void {
  if (locating.value) return
  locating.value = true
  geoMessage.value = 'Localisation...'
  navigator.geolocation.getCurrentPosition(async pos => {
    const lat = Math.round(pos.coords.latitude * 1000) / 1000
    const lon = Math.round(pos.coords.longitude * 1000) / 1000
    if (!inFranceBounds(lat, lon)) {
      locating.value = false
      geoMessage.value = 'Position hors de la zone couverte (France et pays voisins).'
      return
    }
    let name: string | null = null
    try { name = await reverseGeocodeName(lat, lon) } catch { /* nom facultatif */ }
    locating.value = false
    geoMessage.value = ''
    setPlace({ name: name ?? 'Ma position', lat, lon })
  }, err => {
    locating.value = false
    geoMessage.value = err.code === err.PERMISSION_DENIED
      ? 'Géolocalisation refusée (autorise-la dans le navigateur, et il faut du HTTPS).'
      : 'Position introuvable pour le moment.'
  }, { timeout: 10000, maximumAge: 60000 })
}

function onTrip(e: Event): void {
  setTripMin(parseInt((e.target as HTMLInputElement).value, 10))
}

function onReminder(e: Event): void {
  setReminderTime((e.target as HTMLInputElement).value)
}

const reminderLabel = computed(() => icsLabel(reminderTime.value))

function addReminder(): void {
  const ics = buildReminderIcs(place.value, reminderTime.value, new Date(), dest.value)
  if (ics) downloadIcs(ics, 'pleutpas-rappel.ics')
}

function pickPlace(r: GeoResult): void {
  geoMessage.value = ''
  setPlace({ name: r.name, lat: r.lat, lon: r.lon })
}

function pickDest(r: GeoResult): void {
  setDest({ name: r.name, lat: r.lat, lon: r.lon })
}
</script>

<template>
  <section class="card">
    <div class="flex items-start justify-between gap-2">
      <h2 class="hdr">Réglages</h2>
      <button
        type="button" class="-mr-2 -mt-2 flex h-9 w-9 flex-none cursor-pointer items-center justify-center text-xl leading-none text-dim active:text-ink"
        aria-label="Fermer les réglages" @click="emit('close')"
      >✕</button>
    </div>
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
    <label class="mb-2 mt-4 block text-sm" for="reminderTime">Rappel avant le départ : <b>{{ reminderLabel }}</b></label>
    <div class="flex gap-2">
      <input
        id="reminderTime" type="time" :value="reminderTime" step="300"
        class="min-w-0 flex-1 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-[15px] text-ink"
        @change="onReminder"
      >
      <button class="flex-none cursor-pointer rounded-[10px] border border-line bg-panel2 px-3.5 py-2.5 text-sm active:bg-line" @click="addReminder">Ajouter à mon agenda</button>
    </div>
    <p class="mt-1.5 text-[13px] text-dim">Indique ton heure de départ. Ton agenda te préviendra {{ REMINDER_LEAD_MIN }} min avant, du lundi au vendredi, et un tap ouvrira la météo de {{ routeLabel(place, dest) }}.</p>
  </section>
</template>
