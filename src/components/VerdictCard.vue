<script setup lang="ts">
import { computed } from 'vue'
import { dest, fetchedAt, frameSamples, nowTick, place, radarPending, refreshing, trip, tripMin, weather } from '../store'
import { bearingDeg, computeVerdict, conditionsAt, fmtConditions, fmtHM, routeLabel, type VerdictView } from '../lib/meteo'

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
    <div v-if="fetchedAt" class="mt-1.5 text-xs opacity-75">{{ foot }}</div>
  </section>
</template>
