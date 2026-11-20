<script setup lang="ts">
import { computed } from 'vue'
import { departAt, dest, fetchedAt, forecast, forecastMF, forecastMFDest, frameSamples, nowTick, radarPending, refMs, refreshing, setDepartAt, trip, tripMin } from '../store'
import { bearingDeg, clockParts, computeVerdict, conditionsAt, departureMs, fmtConditions, fmtDayHM, routeLabel, winterNote, type InfoText, type Place, type VerdictView } from '../lib/meteo'
import { sunNote } from '../lib/sun'

const props = defineProps<{ place: Place }>()

const verdict = computed<VerdictView>(() => {
  if (!forecast.value) {
    return refreshing.value
      ? { state: 'inconnu', big: '...', sub: 'Chargement', detail: '' }
      : { state: 'inconnu', big: '?', sub: 'Météo injoignable', detail: 'Vérifie ta connexion puis actualise.' }
  }
  if (radarPending.value && frameSamples.value === null) {
    return { state: 'inconnu', big: '...', sub: 'Vérification du radar', detail: '' }
  }
  return computeVerdict(trip.value, tripMin.value, nowTick.value, fetchedAt.value, refMs.value)
})

const conditions = computed(() => {
  if (!forecast.value || verdict.value.state === 'inconnu') return null
  const c = conditionsAt(forecast.value.conditions, refMs.value)
  if (!c) return null
  const d = dest.value
  return fmtConditions(c, d ? bearingDeg(props.place, d) : null)
})

const notes = computed<InfoText[]>(() => {
  if (!forecast.value || verdict.value.state === 'inconnu') return []
  const out: InfoText[] = []
  const winter = winterNote(forecastMF.value, forecastMFDest.value, dest.value !== null, refMs.value, nowTick.value)
  if (winter) out.push(winter)
  const sun = sunNote(props.place, refMs.value, tripMin.value, nowTick.value)
  if (sun) out.push(sun)
  return out
})

const departText = computed(() => (departAt.value === null ? 'maintenant' : fmtDayHM(departAt.value, nowTick.value)))
const departValue = computed(() => {
  if (departAt.value === null) return ''
  const { h, m } = clockParts(departAt.value)
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0')
})

function onDepart(e: Event): void {
  const v = (e.target as HTMLInputElement).value
  setDepartAt(v ? departureMs(v, Date.now()) : null)
}

const foot = computed(() => {
  const d = dest.value
  return d ? routeLabel(props.place, d) + ', ' + tripMin.value + ' min' : 'trajet de ' + tripMin.value + ' min'
})
</script>

<template>
  <section
    class="flex min-h-[186px] flex-col justify-center rounded-2xl px-3.5 py-4 text-center text-white transition-colors desk:min-h-[230px]"
    :class="{ 'v-oui': verdict.state === 'oui', 'v-bof': verdict.state === 'bof', 'v-pluie': verdict.state === 'pluie', 'v-inconnu': verdict.state === 'inconnu' }"
  >
    <div class="text-[clamp(44px,14vw,72px)] font-extrabold leading-none tracking-wide desk:text-[84px]">{{ verdict.big }}</div>
    <div class="mt-1 text-lg font-semibold leading-tight desk:text-[22px]">{{ verdict.sub }}</div>
    <div v-if="verdict.detail" class="mt-0.5 text-sm leading-snug opacity-90 desk:text-[17px]">{{ verdict.detail }}</div>
    <div v-if="conditions || notes.length" class="mt-0.5 text-sm leading-snug opacity-90 desk:text-[17px] [text-wrap:pretty]">
      <template v-if="conditions">{{ conditions.temp }} <span :class="{ 'font-bold': conditions.strong, 'text-amber-300': conditions.strong && verdict.state !== 'bof' }">{{ conditions.wind }}</span></template>
      <span v-for="n in notes" :key="n.text" :class="{ 'font-bold': n.strong, 'text-amber-300': n.strong && verdict.state !== 'bof' }">{{ ' ' + n.text }}</span>
    </div>
    <div class="mt-1 flex flex-wrap items-center justify-center gap-x-1.5 text-[13px] leading-snug opacity-80 desk:text-[15px]">
      <span class="relative inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-1.5 font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white">
        Départ {{ departText }}
        <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
        <input
          type="time" step="300" autocomplete="off" :value="departValue" aria-label="Heure de départ, maintenant si vide"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0" @change="onDepart"
        >
      </span>
      <button v-if="departAt !== null" type="button" class="-ml-1 cursor-pointer rounded px-1.5 py-1 text-sm leading-none" aria-label="Revenir à maintenant" title="Revenir à maintenant" @click="setDepartAt(null)">✕</button>
      <span>· {{ foot }}</span>
    </div>
  </section>
</template>
