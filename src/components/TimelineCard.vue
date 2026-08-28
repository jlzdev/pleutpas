<script setup lang="ts">
import { computed } from 'vue'
import { nowTick, rainMF, slots } from '../store'
import { fmtHM, STEP_5MIN_MS, timelineCells, type TimelineCell } from '../lib/meteo'

const cells = computed<TimelineCell[]>(() => timelineCells(slots.value, rainMF.value, nowTick.value))

const rainMarks = computed(() => {
  const c = cells.value
  const marks: { i: number; label: string; left: string }[] = []
  const firstWet = c.findIndex(x => x.wet)
  if (firstWet < 0) return marks
  const push = (i: number) => {
    if (i >= 3 && i <= c.length - 2 && !marks.some(m => Math.abs(m.i - i) < 3)) {
      marks.push({ i, label: fmtHM(c[i].start), left: (i / c.length) * 100 + '%' })
    }
  }
  if (firstWet > 0) {
    push(firstWet)
    let lastWet = c.length - 1
    while (!c[lastWet].wet) lastWet--
    if (lastWet < c.length - 1) push(lastWet + 1)
  } else {
    const calm = c.findIndex(x => !x.wet)
    if (calm > 0) push(calm)
  }
  return marks
})

const ticks = computed(() => cells.value
  .map((c, i) => ({ start: c.start, i }))
  .filter(({ start, i }) => i >= 3 && i <= 21 && new Date(start).getMinutes() % 30 === 0
    && !rainMarks.value.some(m => Math.abs(m.i - i) < 3))
  .map(({ start, i }) => ({ label: fmtHM(start), left: (i / cells.value.length) * 100 + '%' })))

function fmtDelay(mins: number): string {
  if (mins < 60) return mins + ' min'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? h + ' h ' + String(m).padStart(2, '0') : h + ' h'
}

const note = computed(() => {
  const c = cells.value
  if (!c.length) return 'Pas de données pour le moment.'
  const horizon = c.length >= 24
    ? 'sur les 2 prochaines heures'
    : 'd\'ici ' + fmtHM(c[c.length - 1].start + STEP_5MIN_MS)
  const firstWet = c.findIndex(x => x.wet)
  if (firstWet < 0) return 'Pas de pluie prévue ' + horizon + '.'
  if (firstWet === 0) {
    const calm = c.findIndex(x => !x.wet)
    return calm < 0
      ? 'Pluie en ce moment, sans interruption ' + horizon + '.'
      : 'Pluie en ce moment, accalmie vers ' + fmtHM(c[calm].start) + '.'
  }
  const startMs = c[firstWet].start
  const mins = Math.max(1, Math.round((startMs - nowTick.value) / 60000))
  let lastWet = c.length - 1
  while (!c[lastWet].wet) lastWet--
  const head = 'Pluie dans ' + fmtDelay(mins)
  return lastWet === c.length - 1
    ? head + ', à partir de ' + fmtHM(startMs) + '.'
    : head + ', de ' + fmtHM(startMs) + ' à ' + fmtHM(c[lastWet].start + STEP_5MIN_MS) + '.'
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">Les 2 prochaines heures</h2>
    <template v-if="cells.length">
      <div class="mb-1 text-[11px] text-dim">Chaque case = 5 min, couleur = intensité de la pluie</div>
      <div class="flex h-7 gap-px overflow-hidden rounded-md desk:h-9">
        <span
          v-for="(c, i) in cells" :key="i" :title="c.title"
          class="flex-1" :style="{ background: c.color ?? 'var(--color-line)' }"
        ></span>
      </div>
      <div class="relative mt-1 h-5">
        <span class="absolute left-0 top-0 text-[10px] font-bold text-ink desk:text-xs">maint.</span>
        <template v-for="t in ticks" :key="t.label">
          <span class="absolute top-0 h-1.5 w-px bg-dim" :style="{ left: t.left }"></span>
          <span class="absolute top-1.5 -translate-x-1/2 text-[10px] text-dim desk:text-xs" :style="{ left: t.left }">{{ t.label }}</span>
        </template>
        <template v-for="m in rainMarks" :key="m.i">
          <span class="absolute top-0 h-1.5 w-px bg-ink" :style="{ left: m.left }"></span>
          <span class="absolute top-1.5 -translate-x-1/2 text-[10px] font-bold text-ink desk:text-xs" :style="{ left: m.left }">{{ m.label }}</span>
        </template>
      </div>
      <div class="mt-3.5 flex overflow-hidden rounded-md text-center text-[10px] font-semibold leading-tight text-[#06121f] desk:text-xs">
        <span class="flex flex-1 items-center justify-center bg-traces py-0.5 text-white">Traces</span>
        <span class="flex flex-1 items-center justify-center bg-bruine py-0.5">Bruine</span>
        <span class="flex flex-1 items-center justify-center bg-legere py-0.5">Légère</span>
        <span class="flex flex-1 items-center justify-center bg-modere py-0.5 text-white">Modérée</span>
        <span class="flex flex-1 items-center justify-center bg-fort py-0.5 text-white">Forte</span>
        <span class="flex flex-1 items-center justify-center bg-tresfort py-0.5 text-white">Très forte</span>
        <span class="flex flex-1 items-center justify-center bg-grele py-0.5">Grêle</span>
      </div>
    </template>
    <div class="mt-2 text-[13px] desk:text-sm" :class="cells.some(c => c.wet) ? 'text-ink' : 'text-dim'">{{ note }}</div>
  </section>
</template>
