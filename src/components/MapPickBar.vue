<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string | null; resolving: boolean; pending: boolean; outside: boolean; canStart: boolean; canDest: boolean; hasDest: boolean }>()
const emit = defineEmits<{ start: []; dest: []; cancel: []; removeDest: [] }>()

const text = computed(() => {
  if (props.outside) return 'Hors de la zone couverte'
  if (props.resolving) return props.pending ? 'Recherche de l\'adresse, puis validation...' : 'Recherche de l\'adresse...'
  return props.name ?? 'Lieu sans nom'
})
</script>

<template>
  <div class="mt-2.5 flex min-h-5 items-center gap-2 text-sm" role="status" aria-live="polite">
    <span v-if="resolving" class="block h-4 w-4 flex-none animate-spin rounded-full border-2 border-line border-t-ink"></span>
    <span class="min-w-0 truncate" :class="name && !outside && !resolving ? 'font-semibold' : 'text-dim'">{{ text }}</span>
  </div>
  <div class="mt-2 flex gap-2">
    <button type="button" class="pickbtn flex-1" :disabled="!canStart || pending" @click="emit('start')">Partir d'ici</button>
    <button type="button" class="pickbtn flex-1" :disabled="!canDest || pending" @click="emit('dest')">Arriver ici</button>
    <button type="button" class="pickbtn pickbtn-dim flex-none px-3" @click="emit('cancel')">Annuler</button>
  </div>
  <button v-if="hasDest" type="button" class="pickbtn pickbtn-dim mt-2 w-full px-3" @click="emit('removeDest')">Retirer l'arrivée, garder le départ</button>
</template>
