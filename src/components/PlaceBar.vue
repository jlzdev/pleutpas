<script setup lang="ts">
import { computed } from 'vue'
import { dest, insertSaved, MAX_SAVED, removeSaved, saveCurrent, saved, savedIndex } from '../store'
import { routeLabel, routeLabels, type Place } from '../lib/meteo'
import { showToast } from '../lib/toast'

const props = defineProps<{ place: Place }>()
const emit = defineEmits<{ pick: []; prefs: [edit: number | null] }>()

const labels = computed(() => routeLabels(props.place, dest.value))
const isFav = computed(() => savedIndex.value >= 0)
const favLabel = computed(() => {
  const what = dest.value ? 'ce trajet' : 'ce lieu'
  return isFav.value ? 'Retirer ' + what + ' des favoris' : 'Mettre ' + what + ' en favori'
})

function toggleFav(): void {
  const i = savedIndex.value
  if (i >= 0) {
    const s = saved.value[i]
    removeSaved(i)
    showToast({ text: s.name + ' retiré des favoris.', action: { label: 'Annuler', run: () => { insertSaved(i, s) } } })
    return
  }
  if (!saveCurrent('')) {
    showToast({ text: MAX_SAVED + ' favoris au plus, retires-en un pour en ajouter.', action: { label: 'Gérer', run: () => emit('prefs', null) } })
    return
  }
  const added = savedIndex.value
  showToast({ text: saved.value[added].name + ' ajouté à tes favoris.', action: { label: 'Renommer', run: () => emit('prefs', added) } })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button" class="flex min-h-[46px] min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-[10px] border border-field-line bg-field px-3 text-left text-[15px] font-semibold text-ink active:bg-panel2"
      :aria-label="'Changer de lieu ou de trajet, actuellement ' + routeLabel(place, dest)" @click="emit('pick')"
    >
      <svg class="h-5 w-5 flex-none text-accent" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M10 18s6-5.6 6-10a6 6 0 0 0-12 0c0 4.4 6 10 6 10z"/><circle cx="10" cy="8" r="2"/></svg>
      <span class="min-w-0 flex-1 truncate">{{ labels[0] }}<template v-if="labels[1]"><span class="font-normal text-dim">{{ ' vers ' }}</span>{{ labels[1] }}</template></span>
      <svg class="h-4 w-4 flex-none text-dim" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>
    </button>
    <button
      type="button" class="iconbtn !h-[46px] !w-[46px]" :class="isFav ? '!border-accent text-accent' : ''"
      :aria-pressed="isFav" :aria-label="favLabel" :title="favLabel" @click="toggleFav"
    >
      <svg class="h-5 w-5" viewBox="0 0 20 20" :fill="isFav ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L10 14.3l-4.6 2.5.9-5.2L2.5 8l5.2-.8z"/></svg>
    </button>
  </div>
</template>
