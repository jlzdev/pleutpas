<script setup lang="ts">
import { dismissInstall, installState, promptInstall } from '../lib/install'
</script>

<template>
  <div v-if="installState !== 'hidden'" class="flex items-center gap-3 rounded-2xl border border-line bg-panel px-3.5 py-2.5 text-sm">
    <img src="/icons/icon.svg" alt="" class="h-9 w-9 flex-none">
    <div class="min-w-0 flex-1">
      <b>Ajoute Pleut pas ? à ton écran d'accueil</b>
      <span v-if="installState === 'ios'" class="block text-[13px] text-dim">Bouton Partager, puis "Sur l'écran d'accueil".</span>
      <span v-else class="block text-[13px] text-dim">Comme une appli, sans passer par un store.</span>
    </div>
    <button
      v-if="installState === 'android'"
      class="flex-none cursor-pointer rounded-[10px] bg-legere px-3 py-2 text-sm font-semibold text-night active:opacity-80"
      @click="promptInstall"
    >Installer</button>
    <button class="iconbtn !h-9 !w-9 text-base" aria-label="Ne plus proposer" @click="dismissInstall">✕</button>
  </div>
</template>
