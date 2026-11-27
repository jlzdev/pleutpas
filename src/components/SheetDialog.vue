<script lang="ts">
let sheetCount = 0
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ open: boolean; title: string; full?: boolean }>()
const emit = defineEmits<{ close: [] }>()

const dlg = ref<HTMLDialogElement | null>(null)
const id = ++sheetCount

const isMine = (): boolean => (history.state as { ppSheet?: number } | null)?.ppSheet === id

function sync(open: boolean): void {
  const d = dlg.value
  if (!d) return
  if (open && !d.open) {
    d.showModal()
    history.pushState({ ppSheet: id }, '')
  } else if (!open && d.open) {
    d.close()
    if (isMine()) history.back()
  }
}

function onPop(): void {
  if (props.open) emit('close')
}

function onCancel(e: Event): void {
  e.preventDefault()
  emit('close')
}

let pressedOutside = false

function onPress(e: PointerEvent): void {
  pressedOutside = e.target === dlg.value
}

function onBackdrop(e: MouseEvent): void {
  if (pressedOutside && e.target === dlg.value) emit('close')
}

watch(() => props.open, sync)
onMounted(() => {
  window.addEventListener('popstate', onPop)
  sync(props.open)
})
onBeforeUnmount(() => {
  window.removeEventListener('popstate', onPop)
  if (isMine()) history.back()
})
</script>

<template>
  <dialog
    ref="dlg" :aria-label="title"
    class="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto w-full max-w-[640px] overflow-hidden rounded-t-[20px] border border-b-0 border-line bg-panel p-0 text-left text-base font-normal leading-normal text-ink backdrop:bg-black/60"
    @cancel="onCancel" @pointerdown="onPress" @click="onBackdrop"
  >
    <div class="flex max-h-[calc(100dvh-2.5rem)] flex-col" :class="full ? 'h-[calc(100dvh-2.5rem)]' : ''">
      <div class="flex flex-none items-center gap-2 px-3.5 pt-3">
        <h2 class="min-w-0 flex-1 text-lg font-bold">{{ title }}</h2>
        <button type="button" class="iconbtn" aria-label="Fermer" @click="emit('close')">
          <svg class="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13"/></svg>
        </button>
      </div>
      <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 pb-4 pt-3">
        <slot v-if="open" />
      </div>
      <div class="flex-none border-t border-line px-3.5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <button type="button" class="h-[46px] w-full cursor-pointer rounded-[10px] bg-accent text-[15px] font-semibold text-on-accent active:opacity-80" @click="emit('close')">C'est bon</button>
      </div>
    </div>
  </dialog>
</template>
