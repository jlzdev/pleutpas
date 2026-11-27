<script setup lang="ts">
import { computed } from 'vue'
import { dest, saved, savedIndex, setTripMinByUser, tripMin } from '../store'
import { distanceKm, estimatedTripMin, fmtMinutes, MAX_TRIP_MIN, MIN_TRIP_MIN, TRIP_SPEED_KMH, type Place } from '../lib/meteo'
import SheetDialog from './SheetDialog.vue'

const props = defineProps<{ open: boolean; place: Place }>()
const emit = defineEmits<{ close: [] }>()

const SHORT_TRIP_KM = 4
const STEP_MIN = 5
const QUICK = [10, 15, 20, 30, 45, 60, 90]

const hint = computed(() => {
  const d = dest.value
  if (!d) return { text: 'C\'est le temps que tu passes dehors : le verdict regarde la pluie sur cette durée.', warn: false }
  const km = distanceKm(props.place, d)
  const min = Math.max(MIN_TRIP_MIN, estimatedTripMin(props.place, d))
  const base = 'À vol d\'oiseau ' + (km < 10 ? km.toFixed(1).replace('.', ',') : Math.round(km)) + ' km, soit environ ' + fmtMinutes(min) + ' à ' + TRIP_SPEED_KMH + ' km/h.'
  if (min > MAX_TRIP_MIN) {
    return { text: base + ' Trop long pour une lecture sur le parcours : l\'app suppose que tu le fais en ' + fmtMinutes(MAX_TRIP_MIN) + ', fie-toi surtout au départ et à l\'arrivée.', warn: true }
  }
  if (km < SHORT_TRIP_KM) {
    return { text: base + ' Si près, l\'arrivée ne change rien au verdict : la pluie est connue à 2 km près.', warn: false }
  }
  return { text: base, warn: false }
})

const favName = computed(() => (savedIndex.value >= 0 ? saved.value[savedIndex.value].name : ''))
</script>

<template>
  <SheetDialog :open="open" title="Durée du trajet" @close="emit('close')">
    <div class="flex items-center justify-center gap-4">
      <button type="button" class="iconbtn !h-12 !w-12 text-accent" aria-label="5 minutes de moins" :disabled="tripMin <= MIN_TRIP_MIN" @click="setTripMinByUser(tripMin - STEP_MIN)">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 10h12"/></svg>
      </button>
      <output class="min-w-[9rem] text-center text-[34px] font-extrabold leading-none" aria-live="polite">{{ fmtMinutes(tripMin) }}</output>
      <button type="button" class="iconbtn !h-12 !w-12 text-accent" aria-label="5 minutes de plus" :disabled="tripMin >= MAX_TRIP_MIN" @click="setTripMinByUser(tripMin + STEP_MIN)">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>
      </button>
    </div>
    <div class="mt-4 flex flex-wrap justify-center gap-2" role="group" aria-label="Durées courantes, en minutes">
      <button
        v-for="q in QUICK" :key="q" type="button"
        class="h-11 min-w-[3.25rem] cursor-pointer rounded-full border px-3 text-sm font-semibold"
        :class="q === tripMin ? 'border-accent bg-panel2 text-ink' : 'border-line bg-panel text-dim active:bg-panel2'"
        :aria-pressed="q === tripMin" @click="setTripMinByUser(q)"
      >{{ q }}</button>
    </div>
    <p class="mt-4 text-[13px] [text-wrap:pretty]" :class="hint.warn ? 'text-warn' : 'text-dim'">{{ hint.text }}</p>
    <p v-if="favName" class="mt-1 text-[13px] text-dim">Ton favori {{ favName }} retient cette durée.</p>
  </SheetDialog>
</template>
