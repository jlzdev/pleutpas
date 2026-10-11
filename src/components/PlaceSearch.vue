<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { searchPlaces, type GeoNear, type GeoResult } from '../lib/api'

const props = defineProps<{ id: string; near: GeoNear; clearable?: boolean }>()
const emit = defineEmits<{ pick: [r: GeoResult]; clear: [] }>()

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

const query = ref('')
const results = ref<GeoResult[]>([])
const message = ref('')
const searching = ref(false)

let timer = 0
let controller: AbortController | null = null
let searchSeq = 0

async function search(): Promise<void> {
  const q = query.value.trim()
  controller?.abort()
  if (q.length < MIN_CHARS) {
    results.value = []
    message.value = ''
    searching.value = false
    return
  }
  const seq = ++searchSeq
  controller = new AbortController()
  searching.value = true
  try {
    const found = await searchPlaces(q, props.near, controller.signal)
    if (seq !== searchSeq) return
    results.value = found
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

function onEnter(): void {
  clearTimeout(timer)
  if (results.value.length) {
    pick(results.value[0])
    return
  }
  if (query.value.trim().length < MIN_CHARS) {
    message.value = 'Tape au moins ' + MIN_CHARS + ' lettres.'
    return
  }
  void search()
}

function onEscape(): void {
  clearTimeout(timer)
  controller?.abort()
  searchSeq++
  results.value = []
  message.value = ''
  searching.value = false
}

function label(r: GeoResult): string {
  return r.name + (r.area ? ' (' + r.area + ')' : '')
}

function pick(r: GeoResult): void {
  onEscape()
  query.value = ''
  emit('pick', r)
}

function onClear(): void {
  if (query.value) {
    onEscape()
    query.value = ''
    return
  }
  emit('clear')
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <div class="flex gap-2">
    <div class="relative min-w-0 flex-1">
      <input
        :id="id" v-model="query" type="search" placeholder="Ville, ou rue et ville..." autocomplete="off"
        class="w-full rounded-[10px] border border-line bg-panel2 py-2.5 pl-3 text-[15px] text-ink"
        :class="query || clearable ? 'pr-16' : 'pr-3'"
        @keydown.enter.prevent="onEnter" @keydown.escape="onEscape"
      >
      <span v-if="searching" class="absolute top-1/2 block h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-ink" :class="query || clearable ? 'right-12' : 'right-3'" aria-label="Recherche en cours"></span>
      <button
        v-if="query || clearable" type="button"
        class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-2xl leading-none text-ink"
        :aria-label="query ? 'Effacer la saisie' : 'Retirer ce lieu'" @click="onClear"
      >✕</button>
    </div>
    <slot name="aside"></slot>
  </div>
  <div v-if="results.length || message" class="mt-2 flex flex-col gap-1.5">
    <button
      v-for="r in results" :key="r.kind + r.lat + '/' + r.lon"
      class="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-left text-sm active:bg-line"
      @click="pick(r)"
    >
      <svg v-if="r.kind === 'town'" class="h-4 w-4 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 14V7l3-2 3 2v7H1zm8 0V3l6-2v13H9zm2-9h2V4h-2v1zm0 3h2V7h-2v1zm0 3h2v-1h-2v1zM3 9h1V8H3v1zm2 0h1V8H5v1zm-2 3h1v-1H3v1zm2 0h1v-1H5v1z"/></svg>
      <svg v-else class="h-4 w-4 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
      <span class="min-w-0 flex-1 truncate">{{ label(r) }}</span>
    </button>
    <div v-if="message" class="text-[13px] text-dim">{{ message }}</div>
  </div>
</template>
