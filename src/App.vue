<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { fetchedAt, nowTick, place, refresh, refreshing } from './store'
import { fmtHM } from './lib/meteo'
import VerdictCard from './components/VerdictCard.vue'
import SettingsCard from './components/SettingsCard.vue'
import TimelineCard from './components/TimelineCard.vue'
import RadarCard from './components/RadarCard.vue'
import DayCard from './components/DayCard.vue'

const settingsOpen = ref(false)
const contact = ['contact', 'pleutpas.fr'].join('@')

watchEffect(() => { document.title = place.value.name + ' - Pleut pas ?' })
const updatedStale = computed(() => fetchedAt.value !== null && nowTick.value - fetchedAt.value > 10 * 60 * 1000)
const updatedText = computed(() => fetchedAt.value === null
  ? ''
  : 'Données de ' + fmtHM(fetchedAt.value) + (updatedStale.value ? ' (anciennes, actualise)' : ''))
</script>

<template>
  <header class="mx-auto flex max-w-[668px] items-center gap-2 px-3.5 pb-1 pt-3 desk:max-w-[888px] desk:pt-4">
    <h1 class="flex-1 text-xl font-bold">
      Je peux rouler ?
      <small class="block text-sm font-normal text-dim"><span class="font-semibold text-ink">{{ place.name }}</span>, vélo boulot</small>
    </h1>
    <button class="iconbtn" aria-label="Réglages" @click="settingsOpen = !settingsOpen">⚙&#xFE0E;</button>
    <button class="iconbtn" aria-label="Actualiser" @click="refresh(true)">
      <span class="inline-block" :class="{ 'animate-spin': refreshing }">⟳</span>
    </button>
  </header>
  <main class="mx-auto flex max-w-[640px] flex-col gap-3.5 px-3.5 pb-6 pt-2.5 desk:max-w-[860px]">
    <VerdictCard />
    <SettingsCard v-show="settingsOpen" />
    <TimelineCard />
    <RadarCard />
    <DayCard />
    <div class="text-center text-xs" :class="updatedStale ? 'text-amber-500' : 'text-dim'">{{ updatedText }}</div>
  </main>
  <footer class="mx-auto max-w-[640px] px-3.5 pb-7 text-center text-xs text-dim desk:max-w-[860px]">
    Prévisions <a class="underline" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>
    (<a class="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC-BY 4.0</a>),
    pluie dans l'heure, lame d'eau radar et prévisions PIAF / AROME-PI <a class="underline" href="https://meteofrance.com/" target="_blank" rel="noopener">Météo-France</a>
    (<a class="underline" href="https://www.etalab.gouv.fr/licence-ouverte-open-licence" target="_blank" rel="noopener">Licence Ouverte</a>),
    nom du lieu <a class="underline" href="https://www.bigdatacloud.com/" target="_blank" rel="noopener">BigDataCloud</a>.
    <span class="block pt-1">Position : {{ place.name }}. Contact : <a class="underline" :href="'mailto:' + contact">{{ contact }}</a>.</span>
  </footer>
</template>
