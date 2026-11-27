<script setup lang="ts">
import { hideToast, toast } from '../lib/toast'

function act(): void {
  const run = toast.value?.action?.run
  hideToast()
  run?.()
}
</script>

<template>
  <div v-if="toast" class="flex items-center gap-2 rounded-2xl bg-ink py-1.5 pl-3.5 pr-1.5 text-sm font-semibold text-night shadow-[0_8px_30px_rgba(0,0,0,0.45)]" role="status">
    <span class="min-w-0 flex-1 py-2 [text-wrap:pretty]">{{ toast.text }}</span>
    <button v-if="toast.action" type="button" class="h-[42px] flex-none cursor-pointer rounded-[10px] px-3 font-bold underline underline-offset-2" @click="act">{{ toast.action.label }}</button>
  </div>
</template>
