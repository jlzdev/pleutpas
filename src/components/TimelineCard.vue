<script setup lang="ts">
import { computed } from 'vue'
import { nowTick, rainMF, slots } from '../store'
import { fmtHM, intensityColor, mfLevelColor, SLOT_MIN, slotIndexNow, WET_MM } from '../lib/meteo'

interface Bar {
  label: string
  now: boolean
  color: string | null
  faint: boolean
  height: string
  title: string
}

const view = computed(() => {
  const idx = slotIndexNow(slots.value, nowTick.value)
  if (idx < 0) return []
  return slots.value.slice(idx, idx + 8)
})

const bars = computed<Bar[]>(() => view.value.map((s, i) => {
  const color = intensityColor(s.mm)
  return {
    label: i === 0 ? 'maint.' : fmtHM(s.start),
    now: i === 0,
    color,
    faint: !color && s.mm > 0,
    height: color ? Math.min(100, 12 + (s.mm / 3) * 88) + '%' : '6%',
    title: fmtHM(s.start) + ' : ' + s.mm.toFixed(1) + ' mm',
  }
}))

const note = computed(() => {
  const wet = view.value.filter(s => s.mm >= WET_MM)
  if (!wet.length) return 'Rien à signaler sur les 2 prochaines heures.'
  const total = view.value.reduce((a, s) => a + s.mm, 0)
  return 'Pluie de ' + fmtHM(wet[0].start) + ' à '
    + fmtHM(wet[wet.length - 1].start + SLOT_MIN * 60000)
    + ', ' + total.toFixed(1) + ' mm au total sur 2 h.'
})

const mfSegments = computed(() => (rainMF.value ?? []).map(e => ({
  color: mfLevelColor(e.level),
  grow: (e.end - e.start) / 300000,
  title: fmtHM(e.start) + ' : ' + e.desc,
})))

const mfRange = computed(() => {
  const entries = rainMF.value
  if (!entries || !entries.length) return null
  return { start: fmtHM(entries[0].start), end: fmtHM(entries[entries.length - 1].end) }
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">Les 2 prochaines heures</h2>
    <div v-if="mfRange" class="mb-3.5">
      <div class="mb-1 text-[11px] text-dim">Pluie dans l'heure (Météo-France, pas de 5 min)</div>
      <div class="flex h-4 gap-0.5 overflow-hidden rounded-md">
        <span v-for="(seg, i) in mfSegments" :key="i" :style="{ background: seg.color, flexGrow: seg.grow }" :title="seg.title"></span>
      </div>
      <div class="mt-1 flex justify-between text-[10px] text-dim">
        <span>{{ mfRange.start }}</span><span>{{ mfRange.end }}</span>
      </div>
    </div>
    <div class="flex h-[92px] items-end gap-1 desk:h-[120px]">
      <div
        v-for="(bar, i) in bars" :key="i" :title="bar.title"
        class="flex h-full flex-1 flex-col justify-end rounded bg-[linear-gradient(to_top,var(--color-line)_0,var(--color-line)_2px,transparent_2px)]"
      >
        <div
          v-if="bar.color || bar.faint" class="rounded-t"
          :style="{ background: bar.color ?? 'var(--color-bruine)', height: bar.height, opacity: bar.faint ? 0.35 : 1 }"
        ></div>
      </div>
    </div>
    <div class="mt-1.5 flex gap-1">
      <div
        v-for="(bar, i) in bars" :key="i"
        class="flex-1 text-center text-[10px] desk:text-xs"
        :class="bar.now ? 'font-bold text-ink' : 'text-dim'"
      >{{ bar.label }}</div>
    </div>
    <div class="mt-3 flex overflow-hidden rounded-md text-center text-[10px] font-semibold text-[#06121f] desk:text-xs">
      <span class="flex-1 bg-traces py-0.5 text-white">Traces</span>
      <span class="flex-1 bg-bruine py-0.5">Bruine</span>
      <span class="flex-1 bg-legere py-0.5">Légère</span>
      <span class="flex-1 bg-modere py-0.5 text-white">Modérée</span>
      <span class="flex-1 bg-fort py-0.5 text-white">Forte</span>
      <span class="flex-1 bg-tresfort py-0.5 text-white">Très forte</span>
      <span class="flex-1 bg-grele py-0.5">Grêle</span>
    </div>
    <div class="mt-2 text-[13px] text-dim desk:text-sm">{{ note }}</div>
  </section>
</template>
