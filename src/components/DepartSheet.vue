<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { departAt, nowTick, setDepartAt } from '../store'
import { clockParts, departureMs, fmtDayHM, STEP_5MIN_MS } from '../lib/meteo'
import SheetDialog from './SheetDialog.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const MINUTES = [0, 15, 30, 45]
const MAX_AHEAD_MS = 24 * 60 * 60 * 1000

const minute = ref(0)
const pad = (n: number): string => String(n).padStart(2, '0')

function syncMinute(): void {
  minute.value = departAt.value === null ? 0 : clockParts(departAt.value).m
}

watch(() => props.open, (open) => { if (open) syncMinute() })

interface HourChoice { h: number; ms: number }

const days = computed(() => {
  const now = nowTick.value
  const today = clockParts(now).day
  const all: HourChoice[] = []
  for (let h = 0; h < 24; h++) {
    const ms = departureMs(pad(h) + ':' + pad(minute.value), now)
    if (ms !== null && ms >= now + STEP_5MIN_MS) all.push({ h, ms })
  }
  all.sort((a, b) => a.ms - b.ms)
  return [
    { label: 'Aujourd\'hui', hours: all.filter((x) => clockParts(x.ms).day === today) },
    { label: 'Demain', hours: all.filter((x) => clockParts(x.ms).day !== today) },
  ].filter((d) => d.hours.length)
})

function pickMinute(m: number): void {
  minute.value = m
  if (departAt.value === null) return
  setDepartAt(departureMs(pad(clockParts(departAt.value).h) + ':' + pad(m), Date.now()))
}

function step(dir: number): void {
  const base = departAt.value ?? Math.ceil(Date.now() / STEP_5MIN_MS) * STEP_5MIN_MS
  setDepartAt(base + dir * STEP_5MIN_MS)
  syncMinute()
}

const canAdd = computed(() => departAt.value === null || departAt.value + STEP_5MIN_MS <= nowTick.value + MAX_AHEAD_MS)
</script>

<template>
  <SheetDialog :open="open" title="Heure de départ" @close="emit('close')">
    <div class="flex items-center justify-center gap-4">
      <button type="button" class="iconbtn !h-12 !w-12 text-accent" aria-label="5 minutes plus tôt" :disabled="departAt === null" @click="step(-1)">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 10h12"/></svg>
      </button>
      <output class="min-w-[11rem] text-center text-[28px] font-extrabold leading-none" aria-live="polite">{{ departAt === null ? 'Maintenant' : fmtDayHM(departAt, nowTick) }}</output>
      <button type="button" class="iconbtn !h-12 !w-12 text-accent" aria-label="5 minutes plus tard" :disabled="!canAdd" @click="step(1)">
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg>
      </button>
    </div>
    <button
      type="button" class="pickbtn mt-4 w-full" :class="departAt === null ? '!border-accent' : 'pickbtn-dim'"
      :aria-pressed="departAt === null" @click="setDepartAt(null)"
    >Maintenant</button>
    <template v-for="d in days" :key="d.label">
      <h3 class="hdr !mb-1.5 mt-4">{{ d.label }}</h3>
      <div class="grid grid-cols-6 gap-1.5" role="group" :aria-label="'Heure de départ, ' + d.label.toLowerCase()">
        <button
          v-for="x in d.hours" :key="x.h" type="button"
          class="h-10 cursor-pointer rounded-[10px] border text-sm font-semibold"
          :class="x.ms === departAt ? 'border-accent bg-panel2 text-ink' : 'border-line bg-panel text-dim active:bg-panel2'"
          :aria-pressed="x.ms === departAt" @click="setDepartAt(x.ms)"
        >{{ x.h }}h</button>
      </div>
    </template>
    <h3 class="hdr !mb-1.5 mt-4">Minutes</h3>
    <div class="grid grid-cols-4 gap-1.5" role="group" aria-label="Minutes">
      <button
        v-for="m in MINUTES" :key="m" type="button"
        class="h-10 cursor-pointer rounded-[10px] border text-sm font-semibold"
        :class="m === minute ? 'border-accent bg-panel2 text-ink' : 'border-line bg-panel text-dim active:bg-panel2'"
        :aria-pressed="m === minute" @click="pickMinute(m)"
      >{{ pad(m) }}</button>
    </div>
  </SheetDialog>
</template>
