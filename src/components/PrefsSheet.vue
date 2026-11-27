<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  dest, insertSaved, MAX_SAVED, moveSavedUp, reminderTime, removeSaved, renameSaved, replaceSavedWithCurrent,
  saved, savedIndex, setReminderTime, setSavedTripMin, type SavedTrip,
} from '../store'
import { fmtMinutes, MAX_TRIP_MIN, MIN_TRIP_MIN, placeUrl, routeLabel, type Place } from '../lib/meteo'
import { buildReminderIcs, downloadIcs, parseHHMM, REMINDER_LEAD_MIN, reminderLabel } from '../lib/ics'
import { setTheme, theme, type Theme } from '../lib/theme'
import SheetDialog from './SheetDialog.vue'

const props = defineProps<{ open: boolean; place: Place; edit: number | null }>()
const emit = defineEmits<{ close: [] }>()

const STEP_MIN = 5
const THEMES: { value: Theme; label: string }[] = [{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Clair' }, { value: 'dark', label: 'Sombre' }]
const SHARE_SVG = 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z'

const label = computed(() => routeLabel(props.place, dest.value))
const editing = ref<number | null>(null)
const nameInput = ref<HTMLInputElement[] | null>(null)
const removed = ref<{ index: number; entry: SavedTrip } | null>(null)
const shareMsg = ref('')
let shareTimer = 0

async function startEdit(i: number | null, focus = false): Promise<void> {
  editing.value = i
  if (i === null || !focus) return
  await nextTick()
  nameInput.value?.[0]?.focus()
  nameInput.value?.[0]?.select()
}

watch(() => props.open, (open) => {
  removed.value = null
  shareMsg.value = ''
  void startEdit(open ? props.edit : null, true)
})

function onName(i: number, e: Event): void {
  renameSaved(i, (e.target as HTMLInputElement).value)
}

function remove(i: number): void {
  removed.value = { index: i, entry: saved.value[i] }
  editing.value = null
  removeSaved(i)
}

function replace(i: number): void {
  removed.value = null
  replaceSavedWithCurrent(i)
}

function undoRemove(): void {
  const r = removed.value
  if (r) insertSaved(r.index, r.entry)
  removed.value = null
}

function moveUp(i: number): void {
  moveSavedUp(i)
  if (editing.value === i) editing.value = i - 1
  else if (editing.value === i - 1) editing.value = i
}

async function share(place: Place, to: Place | null, name: string): Promise<void> {
  const url = placeUrl(place, to)
  clearTimeout(shareTimer)
  shareMsg.value = ''
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Pleut pas ? ' + name, text: 'Je peux rouler ? ' + name, url })
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

const reminderHM = computed<[number, number]>(() => parseHHMM(reminderTime.value) ?? [8, 0])

function onReminder(e: Event, part: 0 | 1): void {
  const hm: [number, number] = [...reminderHM.value]
  hm[part] = Number((e.target as HTMLSelectElement).value)
  setReminderTime(String(hm[0]).padStart(2, '0') + ':' + String(hm[1]).padStart(2, '0'))
}

function addReminder(): void {
  const ics = buildReminderIcs(props.place, reminderTime.value, new Date(), dest.value)
  if (ics) downloadIcs(ics, 'pleutpas-rappel.ics')
}
</script>

<template>
  <SheetDialog :open="open" title="Préférences" full @close="emit('close')">
    <h3 class="hdr flex items-center gap-1.5"><svg class="h-4 w-4 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.8z"/></svg>Favoris<template v-if="saved.length"> ({{ saved.length }} sur {{ MAX_SAVED }})</template></h3>
    <p v-if="!saved.length" class="text-sm text-dim">Aucun favori. Touche l'étoile à côté du lieu pour en ajouter un.</p>
    <ul v-else class="flex flex-col gap-1.5" aria-label="Favoris">
      <li v-for="(s, i) in saved" :key="i">
        <div class="flex items-center gap-2">
          <button v-if="saved.length > 1" type="button" class="iconbtn text-accent" :class="i === 0 ? 'invisible' : ''" :aria-label="'Monter ' + s.name" :title="'Monter ' + s.name" @click="moveUp(i)">
            <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>
          </button>
          <button type="button" class="min-w-0 flex-1 cursor-pointer rounded-[10px] px-1 py-1 text-left active:bg-panel2" :aria-expanded="editing === i" :aria-label="'Modifier ' + s.name" @click="startEdit(editing === i ? null : i)">
            <span class="block truncate font-semibold">{{ s.name }}</span>
            <span class="block truncate text-[13px] text-dim">{{ routeLabel(s.place, s.dest) }}, {{ fmtMinutes(s.tripMin) }}</span>
          </button>
          <button type="button" class="iconbtn text-accent" :class="editing === i ? '!border-accent bg-panel2' : ''" :aria-expanded="editing === i" :aria-label="'Modifier ' + s.name" :title="'Modifier ' + s.name" @click="startEdit(editing === i ? null : i, true)">
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 16l1-4 8-8 3 3-8 8zM12 5l3 3"/></svg>
          </button>
        </div>
        <div v-if="editing === i" class="mb-2 mt-1.5 flex flex-col gap-3 rounded-xl border border-accent bg-panel2 p-3">
          <div>
            <label class="mb-1.5 block text-[13px] text-dim" :for="'favName' + i">Nom</label>
            <input
              :id="'favName' + i" ref="nameInput" type="text" maxlength="30" :value="s.name" autocomplete="off"
              class="w-full rounded-[10px] border border-field-line bg-field px-3 py-2.5 text-[15px] font-semibold text-ink"
              @change="onName(i, $event)" @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
            >
          </div>
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 text-sm text-dim">Durée du trajet</span>
            <button type="button" class="iconbtn text-accent" aria-label="5 minutes de moins" :disabled="s.tripMin <= MIN_TRIP_MIN" @click="setSavedTripMin(i, s.tripMin - STEP_MIN)">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 10h12"/></svg>
            </button>
            <b class="min-w-[4.5rem] text-center" aria-live="polite">{{ fmtMinutes(s.tripMin) }}</b>
            <button type="button" class="iconbtn text-accent" aria-label="5 minutes de plus" :disabled="s.tripMin >= MAX_TRIP_MIN" @click="setSavedTripMin(i, s.tripMin + STEP_MIN)">
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>
            </button>
          </div>
          <button v-if="savedIndex < 0" type="button" class="pickbtn pickbtn-dim !h-auto min-h-[42px] whitespace-normal !border-accent/60 py-2 text-left" @click="replace(i)">
            Remplacer par {{ dest ? 'le trajet affiché' : 'le lieu affiché' }} : <b class="text-ink">{{ label }}</b>
          </button>
          <div class="flex items-center gap-2">
            <button type="button" class="iconbtn text-warn" :aria-label="'Supprimer ' + s.name" :title="'Supprimer ' + s.name" @click="remove(i)">
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11"/></svg>
            </button>
            <button type="button" class="iconbtn text-accent" :aria-label="'Partager ' + s.name" :title="'Partager ' + s.name" @click="share(s.place, s.dest, s.name)">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="SHARE_SVG"/></svg>
            </button>
            <button type="button" class="pickbtn flex-1 !border-accent" @click="startEdit(null)">Terminé</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-if="removed" class="mt-2 flex items-center gap-2 text-sm" role="status">
      <span class="min-w-0 flex-1">{{ removed.entry.name }} supprimé.</span>
      <button type="button" class="pickbtn flex-none !border-accent/60 px-3" @click="undoRemove">Annuler</button>
    </p>

    <h3 class="hdr mt-6 flex items-center gap-1.5"><svg class="h-4 w-4 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="15" cy="4.5" r="2"/><circle cx="5" cy="10" r="2"/><circle cx="15" cy="15.5" r="2"/><path d="M6.8 9l6.4-3.5M6.8 11l6.4 3.5"/></svg>Partager</h3>
    <button type="button" class="pickbtn flex w-full items-center justify-center gap-2 !border-accent/60" @click="share(place, dest, label)">
      <svg class="h-5 w-5 flex-none text-accent" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="SHARE_SVG"/></svg>
      <span class="truncate">Partager {{ label }}</span>
    </button>
    <p v-if="shareMsg" class="mt-1.5 break-all text-[13px] text-dim" role="status">{{ shareMsg }}</p>

    <h3 class="hdr mt-6 flex items-center gap-1.5"><svg class="h-4 w-4 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M3 8.5h14M7 2.5v3M13 2.5v3"/></svg>Rappel dans l'agenda *</h3>
    <div class="flex items-center gap-2">
      <span class="flex-none text-sm text-dim">Départ à</span>
      <select class="h-[42px] min-w-0 flex-1 rounded-[10px] border border-field-line bg-field px-2 text-[15px] font-semibold text-ink" aria-label="Heure de départ habituelle" :value="reminderHM[0]" @change="onReminder($event, 0)">
        <option v-for="h in 24" :key="h" :value="h - 1">{{ h - 1 }} h</option>
      </select>
      <select class="h-[42px] min-w-0 flex-1 rounded-[10px] border border-field-line bg-field px-2 text-[15px] font-semibold text-ink" aria-label="Minutes de départ habituelles" :value="reminderHM[1]" @change="onReminder($event, 1)">
        <option v-for="m in 12" :key="m" :value="(m - 1) * 5">{{ String((m - 1) * 5).padStart(2, '0') }}</option>
      </select>
      <button type="button" class="pickbtn flex-none !border-accent/60 px-3" @click="addReminder">Ajouter</button>
    </div>

    <h3 id="themeLabel" class="hdr mt-6 flex items-center gap-1.5"><svg class="h-4 w-4 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="3.5"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4"/></svg>Affichage</h3>
    <div class="flex gap-2" role="radiogroup" aria-labelledby="themeLabel">
      <button
        v-for="t in THEMES" :key="t.value" type="button" role="radio" :aria-checked="theme === t.value"
        class="pickbtn flex-1" :class="theme === t.value ? '!border-accent' : 'pickbtn-dim'" @click="setTheme(t.value)"
      >{{ t.label }}</button>
    </div>
    <p class="mt-6 text-xs leading-[1.45] text-dim [text-wrap:pretty]">* Ton agenda te préviendra du lundi au vendredi, {{ REMINDER_LEAD_MIN }} min avant ton départ (à {{ reminderLabel(reminderTime) }}), avec le lien vers {{ label }}.</p>
    <p v-if="saved.length" class="mt-1.5 text-xs leading-[1.45] text-dim [text-wrap:pretty]">Les deux premiers favoris sont aussi dans le menu de l'icône de l'app (appui long).</p>
  </SheetDialog>
</template>
