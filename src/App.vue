<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { fetchedAt, nowTick, place, refresh, refreshing } from './store'
import { deviceZone, displayZone, fmtHM } from './lib/meteo'
import VerdictCard from './components/VerdictCard.vue'
import SettingsCard from './components/SettingsCard.vue'
import TimelineCard from './components/TimelineCard.vue'
import RadarCard from './components/RadarCard.vue'
import DayCard from './components/DayCard.vue'
import InstallBanner from './components/InstallBanner.vue'

const settingsOpen = ref(false)
const version = __APP_VERSION__

watchEffect(() => { document.title = place.value.name + ' - Pleut pas ? Je peux rouler à vélo ?' })
const updatedStale = computed(() => fetchedAt.value !== null && nowTick.value - fetchedAt.value > 10 * 60 * 1000)
const zoneNote = computed(() => displayZone.value && displayZone.value !== deviceZone ? ', heure de ' + place.value.name : '')
const updatedText = computed(() => fetchedAt.value === null
  ? ''
  : 'Données de ' + fmtHM(fetchedAt.value) + zoneNote.value + (updatedStale.value ? ' (anciennes, actualise)' : ''))
</script>

<template>
  <header class="mx-auto flex max-w-[668px] items-center gap-2 px-3.5 pb-1 pt-3 desk:max-w-[888px] desk:pt-4">
    <h1 class="flex-1 text-xl font-bold">
      Je peux rouler ?
      <small class="block text-sm font-normal text-dim"><span class="font-semibold text-ink">{{ place.name }}</span>, vélo boulot</small>
    </h1>
    <button class="iconbtn" aria-label="Réglages" @click="settingsOpen = !settingsOpen">⚙&#xFE0E;</button>
    <button class="iconbtn hidden desk:inline-block" aria-label="Actualiser" @click="refresh(true)">
      <span class="inline-block" :class="{ 'animate-spin': refreshing }">⟳</span>
    </button>
  </header>
  <main class="mx-auto flex max-w-[640px] flex-col gap-3.5 px-3.5 pb-6 pt-2.5 desk:max-w-[860px]">
    <InstallBanner />
    <VerdictCard />
    <SettingsCard v-show="settingsOpen" />
    <TimelineCard />
    <RadarCard />
    <DayCard />
    <div class="text-center text-xs" :class="updatedStale ? 'text-amber-500' : 'text-dim'">{{ updatedText }}</div>
    <section class="card text-sm text-dim">
      <h2 class="hdr">Comment ça marche</h2>
      <p>Pleut pas ? répond à une question simple : partir à vélo maintenant, ou plutôt à quelle heure ? Le verdict, OUI ou PLUIE, dépend de la pluie attendue sur la durée de ton trajet.</p>
      <ul class="mt-2 list-disc pl-5">
        <li>La pluie des deux dernières heures au radar, puis la prévision minute par minute (Météo-France pluie dans l'heure, PIAF et AROME, Open-Meteo).</li>
        <li>Les deux prochaines heures en cases de cinq minutes, puis la suite de la journée heure par heure.</li>
        <li>Température, ressenti et vent viennent d'Open-Meteo, mesurés à 10 m en terrain dégagé : en ville, entre les immeubles, le vent réel est plus faible.</li>
        <li>France métropolitaine et pays voisins, choix de la ville ou géolocalisation, installable comme une application sur le téléphone.</li>
      </ul>
    </section>
  </main>
  <footer class="mx-auto flex max-w-[640px] flex-wrap justify-center gap-x-3 gap-y-1 px-3.5 pb-7 text-[11px] leading-4 text-dim desk:max-w-[860px]">
    <span><a class="underline" href="https://open-meteo.com/" target="_blank" rel="noopener" title="Prévisions">Open-Meteo</a>
      (<a class="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>)</span>
    <span><a class="underline" href="https://meteofrance.com/" target="_blank" rel="noopener" title="Pluie dans l'heure, PIAF et AROME-PI">Météo-France</a>
      (<a class="underline" href="https://www.etalab.gouv.fr/licence-ouverte-open-licence" target="_blank" rel="noopener">Licence Ouverte</a>)</span>
    <a class="underline" href="https://adresse.data.gouv.fr/" target="_blank" rel="noopener" title="Recherche de communes">Base Adresse Nationale</a>
    <a class="underline" href="https://geo.api.gouv.fr/decoupage-administratif" target="_blank" rel="noopener" title="Commune d'un point">geo.api.gouv.fr</a>
    <a class="underline" href="https://photon.komoot.io/" target="_blank" rel="noopener" title="Communes hors de France, données OpenStreetMap">Photon</a>
    <a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" title="Fonds de carte et lieux, ODbL">© OpenStreetMap contributors</a>
    <a class="underline" href="https://www.cyclosm.org/" target="_blank" rel="noopener" title="Fond de carte vélo">CyclOSM</a>
    <a class="underline" href="https://github.com/jlzdev/pleutpas/blob/main/CHANGELOG.md" target="_blank" rel="noopener" title="Nouveautés et code source">v{{ version }}</a>
  </footer>
</template>
