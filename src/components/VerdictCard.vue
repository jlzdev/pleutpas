<script setup lang="ts">
import { computed } from 'vue'
import { fetchedAt, nowTick, radarPending, radarMmNow, rainMF, refreshing, slots, tripMin, weather } from '../store'
import { computeVerdict, conditionsAt, fmtConditions, fmtHM, type VerdictView } from '../lib/meteo'

const verdict = computed<VerdictView>(() => {
  if (!weather.value) {
    return refreshing.value
      ? { state: 'inconnu', big: '...', sub: 'Chargement', detail: '' }
      : { state: 'inconnu', big: '?', sub: 'Météo injoignable', detail: 'Vérifie ta connexion puis actualise.' }
  }
  if (radarPending.value && radarMmNow.value === null) {
    return { state: 'inconnu', big: '...', sub: 'Vérification du radar', detail: '' }
  }
  return computeVerdict(slots.value, rainMF.value, radarMmNow.value, tripMin.value, nowTick.value, fetchedAt.value)
})

const conditions = computed(() => {
  if (!weather.value || verdict.value.state === 'inconnu') return null
  const c = conditionsAt(weather.value.minutely_15, nowTick.value)
  return c ? fmtConditions(c) : null
})
</script>

<template>
  <section
    class="rounded-2xl px-3.5 py-5 text-center text-white transition-colors"
    :class="{ 'v-oui': verdict.state === 'oui', 'v-bof': verdict.state === 'bof', 'v-pluie': verdict.state === 'pluie', 'v-inconnu': verdict.state === 'inconnu' }"
  >
    <div class="text-[clamp(44px,14vw,72px)] font-extrabold leading-none tracking-wide desk:text-[84px]">{{ verdict.big }}</div>
    <div class="mt-2 text-lg font-semibold desk:text-[22px]">{{ verdict.sub }}</div>
    <div v-if="verdict.detail" class="mt-1 text-sm opacity-90 desk:text-[17px]">{{ verdict.detail }}</div>
    <div v-if="conditions" class="mt-2 text-sm opacity-90 desk:text-[17px]">
      {{ conditions.temp }} <span :class="{ 'font-bold': conditions.strong, 'text-amber-300': conditions.strong && verdict.state !== 'bof' }">{{ conditions.wind }}</span>
    </div>
    <div v-if="fetchedAt" class="mt-2.5 text-xs opacity-75">Trajet de {{ tripMin }} min, données de {{ fmtHM(fetchedAt) }}</div>
  </section>
</template>
