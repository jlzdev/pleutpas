<script setup lang="ts">
import { applyUpdate, updateDismissed, updateReady } from '../lib/update'
</script>

<template>
  <div v-if="updateReady && !updateDismissed" class="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3.5 py-2.5 text-sm shadow-[0_8px_30px_rgba(0,0,0,0.45)]" role="status">
    <div class="min-w-0 flex-1">
      <b>Nouvelle version disponible</b>
      <span class="block text-[13px] text-dim">Recharge pour en profiter, ça prend une seconde.</span>
    </div>
    <button class="flex-none cursor-pointer rounded-[10px] bg-accent px-3 py-2 text-sm font-semibold text-on-accent active:opacity-80" @click="applyUpdate">Recharger</button>
    <button class="iconbtn !h-9 !w-9 text-base" aria-label="Plus tard" @click="updateDismissed = true">✕</button>
  </div>
</template>
