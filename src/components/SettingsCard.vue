<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { applySaved, canSave, dest, MAX_SAVED, removeSaved, saveCurrent, saved, savedIndex, setDest, setPlace, setTripMin, swapPlaces, tripMin, type SavedTrip } from '../store'
import type { GeoResult } from '../lib/api'
import { distanceKm, estimatedTripMin, fmtMinutes, MAX_TRIP_MIN, placeUrl, routeLabel, TRIP_SPEED_KMH, type Place } from '../lib/meteo'
import { geolocSupported, useLocate } from '../lib/locate'
import { setTheme, theme, type Theme } from '../lib/theme'
import PlaceSearch from './PlaceSearch.vue'

const props = defineProps<{ place: Place }>()
const emit = defineEmits<{ close: [] }>()

const { locating, target: locTarget, message: geoMessage, locateMe, cancel } = useLocate()

const SHORT_TRIP_KM = 4
const THEMES: { value: Theme; label: string }[] = [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]

const tripHint = computed(() => {
  const d = dest.value
  if (!d) return null
  const km = distanceKm(props.place, d)
  const min = Math.max(5, estimatedTripMin(props.place, d))
  const base = 'À vol d\'oiseau ' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km, soit environ ' + fmtMinutes(min) + ' à ' + TRIP_SPEED_KMH + ' km/h.'
  if (min > MAX_TRIP_MIN) {
    return { text: base + ' Trop long pour une lecture sur le parcours : l\'app suppose que tu le fais en ' + fmtMinutes(MAX_TRIP_MIN) + ', fie-toi surtout au départ et à l\'arrivée.', warn: true }
  }
  if (km < SHORT_TRIP_KM) {
    return { text: base + ' Si près, l\'arrivée ne change rien au verdict : la pluie est connue à 2 km près.', warn: false }
  }
  return { text: base, warn: false }
})

function onTrip(e: Event): void {
  setTripMin(parseInt((e.target as HTMLInputElement).value, 10))
}

const label = computed(() => routeLabel(props.place, dest.value))
const shareMsg = ref('')
const saveName = ref('')
let shareTimer = 0

const SHARE_SVG = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'

async function shareTrip(place: Place, to: Place | null, name = routeLabel(place, to)): Promise<void> {
  const url = placeUrl(place, to)
  const text = 'Je peux rouler ? ' + name
  clearTimeout(shareTimer)
  shareMsg.value = ''
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Pleut pas ? ' + name, text, url })
      return
    }
    await navigator.clipboard.writeText(url)
    shareMsg.value = 'Lien copié, colle-le où tu veux.'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return
    shareMsg.value = 'Partage indisponible, le lien est : ' + url
  }
  shareTimer = window.setTimeout(() => { shareMsg.value = '' }, 8000)
}

function shareSaved(s: SavedTrip): Promise<void> {
  return shareTrip(s.place, s.dest, s.name)
}

const depSearch = ref<InstanceType<typeof PlaceSearch> | null>(null)
const arrSearch = ref<InstanceType<typeof PlaceSearch> | null>(null)
watch(() => props.place, () => depSearch.value?.sync())
watch(dest, () => arrSearch.value?.sync())
const depEmpty = ref(false)
const arrEmpty = ref(false)
const fieldsFilled = computed(() => !depEmpty.value && (!dest.value || !arrEmpty.value))
const saving = ref(false)
const saveLabel = computed(() => {
  if (savedIndex.value >= 0) return dest.value ? 'Trajet enregistré' : 'Lieu enregistré'
  if (!canSave.value) return MAX_SAVED + ' trajets au plus : retire-en un dans "Mes trajets" pour en ajouter'
  return dest.value ? 'Sauvegarder ce trajet' : 'Sauvegarder ce lieu'
})
const saveNameInput = ref<HTMLInputElement | null>(null)

async function startSave(): Promise<void> {
  saving.value = true
  await nextTick()
  saveNameInput.value?.focus()
}

function save(): void {
  if (!saveCurrent(saveName.value)) return
  saveName.value = ''
  saving.value = false
}

function cancelSave(): void {
  saveName.value = ''
  saving.value = false
}

watch([savedIndex, fieldsFilled, () => props.place, dest], () => { if (saving.value) cancelSave() })

function pickPlace(r: GeoResult): void {
  cancel()
  setPlace({ name: r.name, lat: r.lat, lon: r.lon })
}

function pickDest(r: GeoResult): void {
  setDest({ name: r.name, lat: r.lat, lon: r.lon })
}
</script>

<template>
  <section class="card">
    <h2 class="hdr">Réglages</h2>
    <div class="grid grid-cols-[24px_minmax(0,1fr)_42px] gap-x-2 gap-y-2">
      <svg class="row-span-2 h-[100px] w-6 self-start" viewBox="0 0 24 100" fill="none" aria-hidden="true">
        <circle cx="12" cy="23" r="5.5" stroke="currentColor" stroke-width="2" class="text-dim"/>
        <circle cx="12" cy="41" r="1.5" fill="currentColor" class="text-dim"/>
        <circle cx="12" cy="48" r="1.5" fill="currentColor" class="text-dim"/>
        <circle cx="12" cy="55" r="1.5" fill="currentColor" class="text-dim"/>
        <path class="text-accent" fill="currentColor" d="M12 65c-4.4 0-8 3.4-8 7.8C4 78.7 12 88 12 88s8-9.3 8-15.2c0-4.4-3.6-7.8-8-7.8zm0 10.6a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6z"/>
      </svg>
      <PlaceSearch id="placeInput" ref="depSearch" :near="place" :current="place.name" label="Point de départ" placeholder="Point de départ" :locate="geolocSupported" :locating="locating && locTarget === 'place'" @pick="pickPlace" @empty="depEmpty = $event" @locate="locateMe('place')" />
      <button
        type="button" class="iconbtn row-span-2 self-center" :class="dest ? '' : 'invisible'"
        aria-label="Inverser le sens du trajet" title="Inverser le sens du trajet" @click="swapPlaces"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3 3 7h3v10h2V7h3L7 3zm10 18 4-4h-3V7h-2v10h-3l4 4z"/></svg>
      </button>
      <PlaceSearch id="destInput" ref="arrSearch" :near="place" :current="dest ? dest.name : ''" label="Arrivée" placeholder="Arrivée (facultatif)" :clearable="dest !== null" :locate="geolocSupported" :locating="locating && locTarget === 'dest'" @pick="pickDest" @clear="setDest(null)" @empty="arrEmpty = $event" @locate="locateMe('dest')" />
    </div>
    <div class="mt-2.5 flex flex-wrap items-center gap-2">
      <button
        v-if="fieldsFilled" type="button"
        class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-line bg-panel2 px-3 py-1.5 text-[13px] font-semibold text-ink active:bg-line disabled:cursor-default disabled:opacity-60"
        :disabled="savedIndex >= 0 || !canSave" :aria-pressed="saving"
        :aria-label="saveLabel" :title="saveLabel" @click="startSave"
      >
        <svg v-if="savedIndex >= 0" class="h-4 w-4 text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10.5l4 4 8-9"/></svg>
        <svg v-else class="h-4 w-4 text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h10v14l-5-3-5 3z"/></svg>
        {{ savedIndex >= 0 ? 'Enregistré' : 'Sauvegarder' }}
      </button>
    </div>
    <div v-if="saving && fieldsFilled" class="mt-2 flex gap-2">
      <input
        ref="saveNameInput" v-model="saveName" type="text" maxlength="30" placeholder="Nom (Travail, École...)" :aria-label="'Nom pour ' + label"
        class="min-w-0 flex-1 rounded-[10px] border border-field-line bg-field px-3 py-2.5 text-[15px] text-ink placeholder:text-dim"
        @keydown.enter.prevent="save" @keydown.escape="cancelSave"
      >
      <button type="button" class="pickbtn flex-none" @click="save">OK</button>
      <button type="button" class="iconbtn" aria-label="Annuler" title="Annuler" @click="cancelSave">
        <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
      </button>
    </div>
    <div v-if="geoMessage" class="mt-2 text-[13px] text-dim">{{ geoMessage }}</div>
    <label class="mb-2 mt-4 block text-sm" for="tripRange">Durée du trajet : <b>{{ tripMin }} min</b></label>
    <input id="tripRange" type="range" class="w-full accent-legere" min="5" :max="MAX_TRIP_MIN" step="5" :value="tripMin" @input="onTrip">
    <p v-if="tripHint" class="mt-1 text-[13px]" :class="tripHint.warn ? 'text-warn' : 'text-dim'">{{ tripHint.text }}</p>
    <p v-if="!dest" class="mt-1 text-[13px] text-dim">Avec une arrivée, la pluie est lue tout le long du trajet, à l'heure où tu y passes.</p>
    <details class="group mt-4">
      <summary class="flex cursor-pointer select-none list-none items-center justify-between gap-2 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-sm active:bg-line [&::-webkit-details-marker]:hidden">
        <span>Mes trajets <span class="text-dim">({{ saved.length }})</span></span>
        <svg class="h-4 w-4 flex-none text-dim transition-transform group-open:rotate-180" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
      </summary>
      <p v-if="saved.length >= MAX_SAVED" class="mt-3 text-[13px] text-warn">{{ MAX_SAVED }} trajets au plus : retire-en un pour en ajouter.</p>
      <p v-if="!saved.length" class="mt-3 text-[13px] text-dim">Aucun trajet enregistré pour le moment.</p>
      <ul v-else class="mt-3 flex flex-col gap-1.5" aria-label="Mes trajets">
        <li v-for="(s, i) in saved" :key="s.name + i" class="flex items-center gap-2">
          <button type="button" class="pickbtn min-w-0 flex-1 truncate text-left" :class="i === savedIndex ? '' : 'pickbtn-dim'" :aria-pressed="i === savedIndex" @click="applySaved(i)">
            {{ s.name }} <span class="font-normal text-dim">· {{ s.tripMin }} min</span>
          </button>
          <button type="button" class="iconbtn" :aria-label="'Partager ' + s.name" :title="'Partager ' + s.name" @click="shareSaved(s)">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="SHARE_SVG"/></svg>
          </button>
          <button type="button" class="iconbtn" :aria-label="'Retirer ' + s.name" :title="'Retirer ' + s.name" @click="removeSaved(i)">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
          </button>
        </li>
      </ul>
      <p v-if="shareMsg" class="mt-1.5 break-all text-[13px] text-dim" role="status">{{ shareMsg }}</p>
    </details>
    <div class="mb-2 mt-4 text-sm" id="themeLabel">Affichage : <b>{{ THEMES.find((t) => t.value === theme)?.label }}</b></div>
    <div class="flex gap-2" role="radiogroup" aria-labelledby="themeLabel">
      <button
        v-for="t in THEMES" :key="t.value" type="button" role="radio" :aria-checked="theme === t.value"
        class="pickbtn flex-1" :class="theme === t.value ? '' : 'pickbtn-dim'" @click="setTheme(t.value)"
      >{{ t.label }}</button>
    </div>
    <button type="button" class="mt-4 w-full cursor-pointer rounded-[10px] border border-accent/60 bg-panel2 px-3 py-3 text-[15px] font-semibold text-ink active:bg-line" @click="emit('close')">C'est bon</button>
  </section>
</template>
