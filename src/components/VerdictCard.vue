<script setup lang="ts">
import { computed } from 'vue'
import { dest, fetchedAt, forecastMF, forecastMFDest, frameSamples, nowTick, place, radarPending, refreshing, trip, tripMin, vigilance, weather } from '../store'
import { bearingDeg, computeVerdict, conditionsAt, fmtConditions, fmtHM, fmtVigilance, routeLabel, winterNote, type InfoText, type VerdictView } from '../lib/meteo'

const verdict = computed<VerdictView>(() => {
  if (!weather.value) {
    return refreshing.value
      ? { state: 'inconnu', big: '...', sub: 'Chargement', detail: '' }
      : { state: 'inconnu', big: '?', sub: 'Météo injoignable', detail: 'Vérifie ta connexion puis actualise.' }
  }
  if (radarPending.value && frameSamples.value === null) {
    return { state: 'inconnu', big: '...', sub: 'Vérification du radar', detail: '' }
  }
  return computeVerdict(trip.value, tripMin.value, nowTick.value, fetchedAt.value)
})

const conditions = computed(() => {
  if (!weather.value || verdict.value.state === 'inconnu') return null
  const c = conditionsAt(weather.value.minutely_15, nowTick.value)
  if (!c) return null
  const d = dest.value
  return fmtConditions(c, d ? bearingDeg(place.value, d) : null)
})

// neige, verglas et vigilance : des informations comme la temperature, jamais un verdict
const notes = computed<InfoText[]>(() => {
  if (!weather.value || verdict.value.state === 'inconnu') return []
  const out: InfoText[] = []
  const winter = winterNote(forecastMF.value, forecastMFDest.value, dest.value !== null, nowTick.value)
  if (winter) out.push(winter)
  const v = fmtVigilance(vigilance.value)
  if (v) out.push(v)
  return out
})

const foot = computed(() => {
  const d = dest.value
  const head = d ? routeLabel(place.value, d) + ', ' + tripMin.value + ' min' : 'Trajet de ' + tripMin.value + ' min'
  return head + ', données de ' + fmtHM(fetchedAt.value as number)
})
</script>

<template>
  <section
    class="rounded-2xl px-3.5 py-4 text-center text-white transition-colors"
    :class="{ 'v-oui': verdict.state === 'oui', 'v-bof': verdict.state === 'bof', 'v-pluie': verdict.state === 'pluie', 'v-inconnu': verdict.state === 'inconnu' }"
  >
    <div class="text-[clamp(44px,14vw,72px)] font-extrabold leading-none tracking-wide desk:text-[84px]">{{ verdict.big }}</div>
    <div class="mt-1 text-lg font-semibold leading-tight desk:text-[22px]">{{ verdict.sub }}</div>
    <div v-if="verdict.detail" class="mt-0.5 text-sm leading-snug opacity-90 desk:text-[17px]">{{ verdict.detail }}</div>
    <div v-if="conditions" class="mt-0.5 text-sm leading-snug opacity-90 desk:text-[17px]">
      {{ conditions.temp }} <span :class="{ 'font-bold': conditions.strong, 'text-amber-300': conditions.strong && verdict.state !== 'bof' }">{{ conditions.wind }}</span>
    </div>
    <div v-if="notes.length" class="mt-0.5 text-sm leading-snug opacity-90 desk:text-[17px]">
      <span v-for="(n, i) in notes" :key="n.text" :class="{ 'font-bold': n.strong, 'text-amber-300': n.strong && verdict.state !== 'bof' }">{{ (i ? ' ' : '') + n.text }}</span>
    </div>
    <div v-if="fetchedAt" class="mt-1.5 text-xs opacity-75">{{ foot }}</div>
  </section>
</template>
