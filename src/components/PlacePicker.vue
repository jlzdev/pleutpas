<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { applySaved, dest, place, recents, samePlace, saved, savedIndex, setDest, setPlace, swapPlaces } from '../store'
import { searchPlaces, type GeoResult } from '../lib/api'
import { routeLabel, type Place } from '../lib/meteo'
import { geolocSupported, useLocate, type LocateTarget } from '../lib/locate'
import SheetDialog from './SheetDialog.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const MIN_CHARS = 3
const DEBOUNCE_MS = 300
const FIELDS: { key: LocateTarget; label: string; empty: string }[] = [
  { key: 'place', label: 'Départ', empty: 'Point de départ' },
  { key: 'dest', label: 'Arrivée', empty: 'Ajouter une arrivée (facultatif)' },
]

const { locating, message: geoMessage, locateMe, cancel: cancelLocate } = useLocate()

const target = ref<LocateTarget>('place')
const editing = ref(false)
const query = ref('')
const inputEl = ref<HTMLInputElement[] | null>(null)
const results = ref<GeoResult[]>([])
let resultsFor = ''
const message = ref('')
const searching = ref(false)

let timer = 0
let controller: AbortController | null = null
let searchSeq = 0

function stopSearch(): void {
  clearTimeout(timer)
  controller?.abort()
  searchSeq++
  results.value = []
  message.value = ''
  searching.value = false
}

async function search(): Promise<void> {
  const q = query.value.trim()
  controller?.abort()
  if (q.length < MIN_CHARS) {
    stopSearch()
    return
  }
  const seq = ++searchSeq
  controller = new AbortController()
  searching.value = true
  try {
    const found = await searchPlaces(q, place.value ?? undefined, controller.signal)
    if (seq !== searchSeq) return
    results.value = found
    resultsFor = q
    message.value = found.length ? '' : 'Aucun lieu trouvé pour "' + q + '" dans la zone couverte (France et pays voisins).'
  } catch (e) {
    if (seq !== searchSeq || (e instanceof DOMException && e.name === 'AbortError')) return
    message.value = 'Recherche indisponible, vérifie ta connexion.'
  } finally {
    if (seq === searchSeq) searching.value = false
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = window.setTimeout(search, DEBOUNCE_MS)
})

function reset(): void {
  stopSearch()
  cancelLocate()
  target.value = 'place'
  editing.value = false
  query.value = ''
}

watch(() => props.open, reset)
onBeforeUnmount(stopSearch)

const valueOf = (key: LocateTarget): Place | null => (key === 'place' ? place.value : dest.value)

async function activate(key: LocateTarget): Promise<void> {
  stopSearch()
  target.value = key
  editing.value = true
  query.value = ''
  await nextTick()
  inputEl.value?.[0]?.focus()
}

function clearQuery(): void {
  if (query.value) query.value = ''
  else editing.value = false
}

function apply(p: Place): void {
  if (target.value === 'dest') setDest(p)
  else setPlace(p)
  emit('close')
}

function pick(r: GeoResult): void {
  apply({ name: r.name, lat: r.lat, lon: r.lon })
}

function onEnter(): void {
  const q = query.value.trim()
  if (q.length < MIN_CHARS) {
    message.value = 'Tape au moins ' + MIN_CHARS + ' lettres.'
  } else if (results.value.length && resultsFor === q) {
    pick(results.value[0])
  } else {
    clearTimeout(timer)
    void search()
  }
}

async function locate(): Promise<void> {
  if (await locateMe(target.value) && props.open) emit('close')
}

function chooseSaved(i: number): void {
  applySaved(i)
  emit('close')
}

const typing = computed(() => query.value.trim().length >= MIN_CHARS)
const listTitle = computed(() => {
  if (target.value === 'place') return 'Changer le départ'
  return dest.value ? 'Changer l\'arrivée' : 'Ajouter une arrivée'
})
const shownRecents = computed(() => recents.value.filter((r) => !samePlace(r, place.value) && !samePlace(r, dest.value)))
</script>

<template>
  <SheetDialog :open="open" title="Où pars-tu ?" full @close="emit('close')">
    <div class="flex items-center gap-2">
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <template v-for="f in FIELDS" :key="f.key">
          <div
            v-if="editing && target === f.key"
            class="flex min-h-[46px] items-center gap-2.5 rounded-[10px] border border-accent bg-field pl-3 outline-2 outline-accent/30"
          >
            <svg v-if="f.key === 'place'" class="h-5 w-5 flex-none text-dim" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/></svg>
            <svg v-else class="h-5 w-5 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M10 18s6-5.6 6-10a6 6 0 0 0-12 0c0 4.4 6 10 6 10z"/><circle cx="10" cy="8" r="2"/></svg>
            <input
              ref="inputEl" v-model="query" type="search" autocomplete="off" :aria-label="f.label" placeholder="Ville, ou rue et ville"
              class="h-[44px] min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-dim"
              @keydown.enter.prevent="onEnter"
            >
            <span v-if="searching" class="block h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-ink" aria-label="Recherche en cours"></span>
            <button type="button" class="flex h-[44px] w-11 flex-none cursor-pointer items-center justify-center text-ink" :aria-label="query ? 'Effacer la saisie' : 'Annuler la saisie'" @mousedown.prevent @click="clearQuery">
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
            </button>
          </div>
          <div v-else class="flex min-h-[46px] items-center rounded-[10px] border bg-field" :class="target === f.key ? 'border-accent' : 'border-field-line'">
            <button
              type="button" class="flex min-h-[44px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 pl-3 pr-2 text-left text-[15px]"
              :aria-label="f.label + ' : ' + (valueOf(f.key)?.name ?? 'aucune') + ', toucher pour changer'" @click="activate(f.key)"
            >
              <svg v-if="f.key === 'place'" class="h-5 w-5 flex-none text-dim" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/></svg>
              <svg v-else class="h-5 w-5 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M10 18s6-5.6 6-10a6 6 0 0 0-12 0c0 4.4 6 10 6 10z"/><circle cx="10" cy="8" r="2"/></svg>
              <span v-if="valueOf(f.key)" class="min-w-0 flex-1 truncate font-semibold text-ink">{{ valueOf(f.key)?.name }}</span>
              <span v-else class="min-w-0 flex-1 truncate text-dim">{{ f.empty }}</span>
            </button>
            <button v-if="f.key === 'dest' && dest" type="button" class="flex h-[44px] w-11 flex-none cursor-pointer items-center justify-center text-ink" aria-label="Retirer l'arrivée" @click="setDest(null)">
              <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
            </button>
          </div>
        </template>
      </div>
      <button v-if="dest" type="button" class="iconbtn text-accent" aria-label="Inverser le sens du trajet" title="Inverser le sens du trajet" @click="swapPlaces">
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 3 3 7h3v10h2V7h3L7 3zm10 18 4-4h-3V7h-2v10h-3l4 4z"/></svg>
      </button>
    </div>

    <template v-if="typing">
      <ul v-if="results.length" class="mt-3 flex flex-col" aria-label="Lieux trouvés">
        <li v-for="r in results" :key="r.kind + r.lat + '/' + r.lon" class="border-b border-line last:border-b-0">
          <button type="button" class="flex min-h-[54px] w-full cursor-pointer items-center gap-3 px-0.5 py-1.5 text-left active:bg-panel2" @click="pick(r)">
            <svg v-if="r.kind === 'town'" class="h-5 w-5 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 14V7l3-2 3 2v7H1zm8 0V3l6-2v13H9zm2-9h2V4h-2v1zm0 3h2V7h-2v1zm0 3h2v-1h-2v1zM3 9h1V8H3v1zm2 0h1V8H5v1zm-2 3h1v-1H3v1zm2 0h1v-1H5v1z"/></svg>
            <svg v-else class="h-5 w-5 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ r.name }}</span>
              <span v-if="r.area" class="block truncate text-[13px] text-dim">{{ r.area }}</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-if="message" class="mt-3 text-[13px] text-dim" role="status">{{ message }}</p>
    </template>

    <template v-else>
      <h3 class="hdr !mb-0 mt-4">{{ listTitle }}</h3>
      <ul class="flex flex-col">
        <li v-if="geolocSupported" class="border-b border-line last:border-b-0">
          <button type="button" class="flex min-h-[54px] w-full cursor-pointer items-center gap-3 px-0.5 py-1.5 text-left active:bg-panel2 disabled:cursor-wait" :disabled="locating" :aria-busy="locating" @click="locate">
            <span v-if="locating" class="block h-5 w-5 flex-none animate-spin rounded-full border-2 border-line border-t-ink"></span>
            <svg v-else class="h-5 w-5 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">Ma position</span>
              <span class="block text-[13px] text-dim">{{ target === 'place' ? 'Partir de là où je suis' : 'Arriver là où je suis' }}</span>
            </span>
          </button>
        </li>
        <li v-for="r in shownRecents" :key="r.lat + '/' + r.lon" class="border-b border-line last:border-b-0">
          <button type="button" class="flex min-h-[54px] w-full cursor-pointer items-center gap-3 px-0.5 py-1.5 text-left active:bg-panel2" @click="apply(r)">
            <svg class="h-5 w-5 flex-none text-dim" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/></svg>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ r.name }}</span>
              <span class="block text-[13px] text-dim">Récent</span>
            </span>
          </button>
        </li>
      </ul>
      <p v-if="geoMessage && !locating" class="mt-2 text-[13px] text-warn" role="alert">{{ geoMessage }}</p>
      <p v-if="message" class="mt-2 text-[13px] text-dim" role="status">{{ message }}</p>

      <template v-if="saved.length">
        <h3 class="hdr !mb-0 mt-5">Favoris</h3>
        <ul class="flex flex-col">
          <li v-for="(s, i) in saved" :key="s.name + i" class="border-b border-line last:border-b-0">
            <button type="button" class="flex min-h-[54px] w-full cursor-pointer items-center gap-3 px-0.5 py-1.5 text-left active:bg-panel2" :aria-current="i === savedIndex ? 'true' : undefined" @click="chooseSaved(i)">
              <svg class="h-5 w-5 flex-none text-accent" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.8z"/></svg>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ s.name }}</span>
                <span class="block truncate text-[13px] text-dim">{{ routeLabel(s.place, s.dest) }}, {{ s.tripMin }} min</span>
              </span>
              <span v-if="i === savedIndex" class="flex-none text-[13px] text-dim">affiché</span>
            </button>
          </li>
        </ul>
      </template>
      <p v-if="!dest" class="mt-4 text-[13px] text-dim [text-wrap:pretty]">Avec une arrivée, la pluie est lue tout le long du trajet, à l'heure où tu y passes.</p>
    </template>
  </SheetDialog>
</template>
