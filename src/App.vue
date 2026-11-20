<script setup lang="ts">
import { computed, defineAsyncComponent, h, ref, watchEffect } from 'vue'
import { applySaved, dest, fetchedAt, nowTick, place, refresh, refreshing, saved, savedIndex, swapPlaces } from './store'
import { deviceZone, displayZone, fmtHM, placeTown, routeLabel, routeLabels } from './lib/meteo'
import VerdictCard from './components/VerdictCard.vue'
import SettingsCard from './components/SettingsCard.vue'
import TimelineCard from './components/TimelineCard.vue'
import UpdateBanner from './components/UpdateBanner.vue'
import DayCard from './components/DayCard.vue'
import InstallBanner from './components/InstallBanner.vue'
import WelcomeCard from './components/WelcomeCard.vue'

const RadarCard = defineAsyncComponent({
  loader: () => import('./components/RadarCard.vue'),
  delay: 0,
  loadingComponent: {
    render: () => h('section', { class: 'card' }, [
      h('h2', { class: 'hdr' }, 'Radar de précipitation'),
      h('div', { class: 'h-[340px] rounded-xl bg-night desk:h-[520px]' }),
      h('div', { class: 'mt-2.5 h-[42px]' }),
      h('div', { class: 'mt-2 h-8 text-xs text-dim' }, 'Chargement de la carte...'),
    ]),
  },
  errorComponent: {
    render: () => h('section', { class: 'card' }, [
      h('h2', { class: 'hdr' }, 'Radar de précipitation'),
      h('p', { class: 'text-sm text-dim' }, 'Carte indisponible pour le moment, recharge la page pour réessayer.'),
    ]),
  },
  onError(_error, retry, fail, attempts) {
    if (attempts <= 3) setTimeout(retry, 1000 * attempts)
    else fail()
  },
})

const settingsOpen = ref(false)
const version = __APP_VERSION__

const route = computed(() => (place.value ? routeLabel(place.value, dest.value) : ''))
const labels = computed<[string, string | null]>(() => (place.value ? routeLabels(place.value, dest.value) : ['Choisis ton lieu', null]))
watchEffect(() => { document.title = (route.value ? route.value + ' - ' : '') + 'Pleut pas ? Je peux rouler à vélo ?' })
const updatedStale = computed(() => fetchedAt.value !== null && nowTick.value - fetchedAt.value > 10 * 60 * 1000)
const zoneNote = computed(() => displayZone.value && displayZone.value !== deviceZone && place.value ? ', heure de ' + placeTown(place.value) : '')
const updatedText = computed(() => fetchedAt.value === null
  ? ''
  : 'Données de ' + fmtHM(fetchedAt.value) + zoneNote.value + (updatedStale.value ? ' (anciennes, actualise)' : ''))
</script>

<template>
  <header class="mx-auto flex max-w-[640px] items-center gap-2 px-3.5 pb-1 pt-3 desk:max-w-[860px] desk:pt-4">
    <h1 class="min-w-0 flex-1 text-xl font-bold">
      Je peux rouler ?
      <small class="block truncate text-sm font-normal text-dim"><span class="font-semibold text-ink">{{ labels[0] }}</span><template v-if="labels[1]"> vers <span class="font-semibold text-ink">{{ labels[1] }}</span></template></small>
    </h1>
    <template v-if="place">
      <button v-if="dest" class="iconbtn" aria-label="Inverser le sens du trajet" title="Inverser le sens du trajet" @click="swapPlaces">⇄&#xFE0E;</button>
      <button class="iconbtn" aria-label="Réglages" @click="settingsOpen = !settingsOpen">⚙&#xFE0E;</button>
      <button class="iconbtn hidden desk:inline-block" aria-label="Actualiser" @click="refresh(true)">
        <span class="inline-block" :class="{ 'animate-spin': refreshing }">⟳</span>
      </button>
    </template>
  </header>
  <nav v-if="place && saved.length" aria-label="Trajets enregistrés" class="mx-auto flex max-w-[640px] gap-2 overflow-x-auto px-3.5 pb-1 pt-1.5 [scrollbar-width:none] desk:max-w-[860px]">
    <button
      v-for="(s, i) in saved" :key="s.name + i" type="button"
      class="flex-none cursor-pointer whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-semibold"
      :class="i === savedIndex ? 'border-accent bg-panel2 text-ink' : 'border-line bg-panel text-dim active:bg-panel2'"
      :aria-pressed="i === savedIndex" @click="applySaved(i)"
    >{{ s.name }}</button>
  </nav>
  <main class="mx-auto flex max-w-[640px] flex-col gap-3.5 px-3.5 pb-6 pt-2.5 desk:max-w-[860px]">
    <SettingsCard v-if="place" v-show="settingsOpen" :place="place" @close="settingsOpen = false" />
    <template v-if="place">
      <VerdictCard :place="place" />
      <TimelineCard />
      <RadarCard :place="place" />
      <DayCard />
      <div class="text-center text-xs" :class="updatedStale ? 'text-warn' : 'text-dim'">{{ updatedText }}</div>
    </template>
    <WelcomeCard v-else />
    <details class="group card text-sm text-dim">
      <summary class="hdr !mb-0 flex cursor-pointer select-none list-none items-center justify-between [&::-webkit-details-marker]:hidden">
        Comment ça marche
        <svg class="h-4 w-4 flex-none transition-transform group-open:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
      </summary>
      <p class="mt-2.5">Pleut pas ? répond à une question simple : partir maintenant, ou plutôt à quelle heure ? Le verdict, OUI ou PLUIE, dépend de la pluie attendue sur la durée de ton trajet.</p>
      <ul class="mt-2 list-disc pl-5">
        <li>La pluie de la dernière heure au radar, puis la prévision minute par minute (Météo-France pluie dans l'heure, PIAF et AROME), puis la prévision Météo-France heure par heure (Open-Meteo hors de France).</li>
        <li>À titre d'information sous le verdict : vigilance Météo-France du département (vent violent, orages, pluie-inondation, neige-verglas), neige ou risque de verglas annoncés pour les deux prochaines heures, et heure de la nuit.</li>
        <li>Les deux prochaines heures en cases de cinq minutes, puis la suite de la journée heure par heure, à partir de maintenant ou de l'heure de départ choisie en touchant "Départ maintenant" au bas du verdict.</li>
        <li>Avec une arrivée dans les réglages, la pluie est lue tout le long du trajet, en ligne droite, à l'heure où tu passes à chaque endroit (précision d'environ 2 km).</li>
        <li>France métropolitaine et pays voisins, choix de la ville, géolocalisation ou épingle posée sur la carte, trajets enregistrés rappelés d'un appui, installable comme une application sur le téléphone.</li>
      </ul>
    </details>
  </main>
  <div class="pointer-events-none fixed inset-x-0 bottom-0 z-[1100] mx-auto flex max-w-[640px] flex-col gap-2 px-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] desk:max-w-[860px] [&>*]:pointer-events-auto">
    <UpdateBanner />
    <InstallBanner />
  </div>
  <footer class="mx-auto flex max-w-[640px] flex-wrap items-center justify-center gap-x-3 px-3.5 pb-7 text-[11px] leading-4 text-dim desk:max-w-[860px] [&_a]:inline-block [&_a]:py-1">
    <span><a class="underline" href="https://meteofrance.com/" target="_blank" rel="noopener" title="Pluie dans l'heure, prévision, vigilance, PIAF et AROME-PI">Météo-France</a>
      (<a class="underline" href="https://www.etalab.gouv.fr/licence-ouverte-open-licence" target="_blank" rel="noopener">Licence Ouverte</a>)</span>
    <a class="underline" href="https://adresse.data.gouv.fr/" target="_blank" rel="noopener" title="Recherche de communes">Base Adresse Nationale</a>
    <a class="underline" href="https://geo.api.gouv.fr/decoupage-administratif" target="_blank" rel="noopener" title="Commune d'un point">geo.api.gouv.fr</a>
    <a class="underline" href="https://photon.komoot.io/" target="_blank" rel="noopener" title="Communes hors de France, données OpenStreetMap">Photon</a>
    <a class="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" title="Fonds de carte et lieux, ODbL">© OpenStreetMap contributors</a>
    <a class="underline" href="mailto:contact@pleutpas.fr" title="Un retour, une idée">contact@pleutpas.fr</a>
    <a class="underline" href="https://github.com/jlzdev/pleutpas/blob/main/CHANGELOG.md" target="_blank" rel="noopener" title="Nouveautés et code source">v{{ version }}</a>
    <span><a class="underline" href="https://open-meteo.com/" target="_blank" rel="noopener" title="Prévisions hors de France et en secours">Open-Meteo</a>
      (<a class="underline" href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>), repli</span>
  </footer>
</template>
