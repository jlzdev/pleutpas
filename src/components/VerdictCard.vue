<script setup lang="ts">
import { computed, ref } from 'vue'
import { departAt, dest, fetchedAt, forecast, forecastMF, forecastMFDest, frameSamples, nowTick, radarPending, refMs, refreshing, setDepartAt, trip, tripMin } from '../store'
import { bearingDeg, computeVerdict, conditionsAt, fmtConditions, fmtDayHM, fmtMinutes, winterNote, type InfoText, type Place, type VerdictView } from '../lib/meteo'
import { sunNote } from '../lib/sun'
import DepartSheet from './DepartSheet.vue'
import DurationSheet from './DurationSheet.vue'

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
  return out
})

interface Part { text: string; strong: boolean; sep: string }

function sentence(items: InfoText[]): Part[] {
  const list = items.filter((n) => n.text)
  return list.map((n, i) => {
    const text = n.text.replace(/\.$/, '')
    return {
      text: i ? text.charAt(0).toLowerCase() + text.slice(1) : text,
      strong: n.strong,
      sep: i === list.length - 1 ? '.' : ', ',
    }
  })
}

const headline = computed(() => sentence([{ text: verdict.value.sub, strong: true }, { text: verdict.value.detail, strong: false }]))

const infos = computed(() => {
  const c = conditions.value
  return sentence([...(c ? [{ text: c.temp, strong: false }, { text: c.wind, strong: c.strong }] : []), ...notes.value])
})

const sun = computed(() => (!forecast.value || verdict.value.state === 'inconnu' ? null : sunNote(props.place, refMs.value, tripMin.value, nowTick.value)))

const departText = computed(() => (departAt.value === null ? 'maintenant' : fmtDayHM(departAt.value, nowTick.value)))
const departOpen = ref(false)
const durationOpen = ref(false)
</script>

<template>
  <section
    class="flex min-h-[180px] flex-col justify-center rounded-2xl px-3.5 py-4 text-center text-white transition-colors desk:min-h-[192px]"
    :class="{ 'v-oui': verdict.state === 'oui', 'v-bof': verdict.state === 'bof', 'v-pluie': verdict.state === 'pluie', 'v-inconnu': verdict.state === 'inconnu' }"
  >
    <div class="text-[clamp(34px,10.5vw,52px)] font-extrabold leading-none tracking-wide desk:text-[60px]">{{ verdict.big }}</div>
    <div v-if="headline.length" class="mt-1.5 text-sm leading-snug desk:text-[17px] [text-wrap:pretty]">
      <template v-for="n in headline" :key="n.text"><span :class="{ 'font-bold': n.strong }">{{ n.text }}</span>{{ n.sep }}</template>
    </div>
    <div v-if="infos.length" class="mt-0.5 text-sm leading-snug desk:text-[17px] [text-wrap:pretty]">
      <template v-for="n in infos" :key="n.text"><span :class="{ 'font-bold': n.strong }">{{ n.text }}</span>{{ n.sep }}</template>
    </div>
    <div v-if="sun" class="text-sm leading-snug desk:text-[17px]">{{ sun.text }}</div>
    <div class="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 whitespace-nowrap text-[13px] font-semibold leading-none desk:text-[15px]">
      <span class="inline-flex h-9 items-center rounded-full border border-white/45 bg-black/15">
        <button
          type="button" class="inline-flex h-full cursor-pointer items-center gap-1 rounded-full pl-2.5 focus-visible:outline-2 focus-visible:outline-white" :class="departAt === null ? 'pr-2.5' : 'pr-1.5'"
          :aria-label="'Heure de départ : ' + departText + ', changer'" @click="departOpen = true"
        >
          Départ {{ departText }}
          <svg class="h-3.5 w-3.5 flex-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
        </button>
        <template v-if="departAt !== null">
          <span class="h-4 w-px flex-none bg-white/45" aria-hidden="true"></span>
          <button type="button" class="inline-flex h-full w-7 flex-none cursor-pointer items-center justify-center rounded-full pr-0.5 focus-visible:outline-2 focus-visible:outline-white" aria-label="Revenir à maintenant" title="Revenir à maintenant" @click="setDepartAt(null)">
            <svg class="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </template>
      </span>
      <button
        type="button" class="inline-flex h-9 cursor-pointer items-center gap-1 rounded-full border border-white/45 bg-black/15 px-2.5 focus-visible:outline-2 focus-visible:outline-white"
        :aria-label="'Durée du trajet : ' + fmtMinutes(tripMin) + ', changer'" @click="durationOpen = true"
      >
        <span v-if="departAt === null" class="max-[399px]:hidden">Trajet de</span>{{ fmtMinutes(tripMin) }}
        <svg class="h-3.5 w-3.5 flex-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
      </button>
    </div>
    <DepartSheet :open="departOpen" @close="departOpen = false" />
    <DurationSheet :open="durationOpen" :place="place" @close="durationOpen = false" />
  </section>
</template>
