<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { searchPlaces, type GeoNear, type GeoResult } from '../lib/api'

const props = defineProps<{ id: string; near?: GeoNear; clearable?: boolean; current?: string; label?: string; placeholder?: string; locate?: boolean; locating?: boolean }>()
const emit = defineEmits<{ pick: [r: GeoResult]; clear: []; empty: [v: boolean]; locate: [] }>()

const MIN_CHARS = 3
const DEBOUNCE_MS = 300

const query = ref('')
const editing = ref(false)
const focused = ref(false)
const inputEl = ref<HTMLInputElement | null>(null)
const results = ref<GeoResult[]>([])
const message = ref('')
const searching = ref(false)

let timer = 0
let controller: AbortController | null = null
let searchSeq = 0
let skipSearch = false

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
  if (skipSearch) {
    skipSearch = false
    return
  }
  timer = window.setTimeout(search, DEBOUNCE_MS)
})

function sync(): void {
  editing.value = false
  const v = props.current ?? ''
  if (query.value === v) return
  onEscape()
  skipSearch = true
  query.value = v
}

watch(() => props.current ?? '', sync, { immediate: true })

defineExpose({ sync })

const showsValue = computed(() => !!props.current && !editing.value)

async function startEdit(keepText: boolean): Promise<void> {
  editing.value = true
  skipSearch = true
  query.value = keepText ? (props.current ?? '') : ''
  await nextTick()
  inputEl.value?.focus()
  if (keepText) inputEl.value?.select()
}

function onBlur(): void {
  focused.value = false
  if (props.current) sync()
}

watch(() => query.value.trim() === '', (v) => emit('empty', v), { immediate: true })

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

function resultLabel(r: GeoResult): string {
  return r.name + (r.area ? ' (' + r.area + ')' : '')
}

function pick(r: GeoResult): void {
  onEscape()
  editing.value = false
  skipSearch = true
  query.value = props.current !== undefined ? r.name : ''
  emit('pick', r)
}

function onLocate(): void {
  editing.value = false
  focused.value = false
  inputEl.value?.blur()
  emit('locate')
}

function onClear(): void {
  onEscape()
  query.value = ''
}

function onClearValue(): void {
  onEscape()
  if (props.clearable) emit('clear')
  else void startEdit(false)
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <div>
  <div class="flex gap-2">
    <div v-if="showsValue" class="relative min-w-0 flex-1">
      <button
        type="button" class="w-full cursor-text truncate rounded-[10px] border border-field-line bg-field py-2.5 pl-3 pr-11 text-left text-[15px] font-semibold text-ink"
        :aria-label="(label ? label + ' : ' : '') + current + ', toucher pour changer'" @click="startEdit(true)"
      >{{ current }}</button>
      <button
        type="button" class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink"
        :aria-label="clearable ? 'Retirer ce lieu' : 'Changer de lieu'" @click="onClearValue"
      >
        <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
      </button>
    </div>
    <div v-else class="relative min-w-0 flex-1">
      <input
        :id="id" ref="inputEl" v-model="query" type="search" :placeholder="placeholder ?? 'Ville, ou rue et ville...'" :aria-label="label" autocomplete="off"
        class="w-full rounded-[10px] border border-field-line bg-field py-2.5 pl-3 text-[15px] text-ink placeholder:text-dim"
        :class="query ? 'pr-16' : 'pr-3'"
        @keydown.enter.prevent="onEnter" @keydown.escape="onEscape" @focus="focused = true" @blur="onBlur"
      >
      <span v-if="searching" class="absolute top-1/2 block h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-ink" :class="query ? 'right-12' : 'right-3'" aria-label="Recherche en cours"></span>
      <button
        v-if="query" type="button"
        class="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center text-ink"
        aria-label="Effacer la saisie" @mousedown.prevent @click="onClear"
      >
        <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
      </button>
    </div>
    <slot name="aside"></slot>
  </div>
  <div v-if="results.length || message || (locate && focused)" class="mt-2 flex flex-col gap-1.5">
    <button
      v-if="locate && focused && !results.length" type="button"
      class="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-left text-sm active:bg-line"
      :aria-busy="locating" @mousedown.prevent @click="onLocate"
    >
      <span v-if="locating" class="block h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-ink"></span>
      <svg v-else class="h-4 w-4 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10" cy="10" r="5"/><circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none"/><path d="M10 1v3M10 16v3M1 10h3M16 10h3"/></svg>
      <span class="min-w-0 flex-1 truncate font-semibold">Ma position</span>
    </button>
    <button
      v-for="r in results" :key="r.kind + r.lat + '/' + r.lon"
      class="flex cursor-pointer items-center gap-2.5 rounded-[10px] border border-line bg-panel2 px-3 py-2.5 text-left text-sm active:bg-line"
      @mousedown.prevent @click="pick(r)"
    >
      <svg v-if="r.kind === 'town'" class="h-4 w-4 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1 14V7l3-2 3 2v7H1zm8 0V3l6-2v13H9zm2-9h2V4h-2v1zm0 3h2V7h-2v1zm0 3h2v-1h-2v1zM3 9h1V8H3v1zm2 0h1V8H5v1zm-2 3h1v-1H3v1zm2 0h1v-1H5v1z"/></svg>
      <svg v-else class="h-4 w-4 flex-none text-dim" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1a5 5 0 0 0-5 5c0 3.6 5 9 5 9s5-5.4 5-9a5 5 0 0 0-5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/></svg>
      <span class="min-w-0 flex-1 truncate">{{ resultLabel(r) }}</span>
    </button>
    <div v-if="message" class="text-[13px] text-dim">{{ message }}</div>
  </div>
  </div>
</template>
