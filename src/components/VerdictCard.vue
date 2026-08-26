<script setup lang="ts">
import { computed } from 'vue'
import { fetchedAt, nowTick, radarWetNow, rainMF, refreshing, slots, tripMin, weather } from '../store'
import { computeVerdict, fmtHM, type VerdictView } from '../lib/meteo'

const verdict = computed<VerdictView>(() => {
  if (!weather.value) {
    return refreshing.value
      ? { state: 'inconnu', big: '...', sub: 'Chargement', detail: '' }
      : { state: 'inconnu', big: '?', sub: 'Météo injoignable', detail: 'Vérifie ta connexion puis actualise.' }
  }
  return computeVerdict(slots.value, rainMF.value, radarWetNow.value, tripMin.value, nowTick.value, fetchedAt.value)
})
</script>

<template>
  <section
    class="rounded-2xl px-3.5 py-6 text-center text-white transition-colors"
    :class="{ 'v-oui': verdict.state === 'oui', 'v-non': verdict.state === 'non', 'v-inconnu': verdict.state === 'inconnu' }"
  >
    <div class="text-[clamp(64px,22vw,110px)] font-extrabold leading-none tracking-wide desk:text-[132px]">{{ verdict.big }}</div>
    <div class="mt-2 text-lg font-semibold desk:text-[22px]">{{ verdict.sub }}</div>
    <div class="mt-1 text-sm opacity-90 desk:text-[17px]">{{ verdict.detail }}</div>
    <div v-if="fetchedAt" class="mt-2.5 text-xs opacity-75">Trajet de {{ tripMin }} min, données de {{ fmtHM(fetchedAt) }}</div>
  </section>
</template>
