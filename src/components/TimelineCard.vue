<script setup lang="ts">
import { computed } from 'vue'
import { dest, nowTick, trip, tripMin } from '../store'
import { clockParts, fmtHM, fmtMinutes, STEP_5MIN_MS, timelineCells, type TimelineCell } from '../lib/meteo'

const cells = computed<TimelineCell[]>(() => timelineCells(trip.value, nowTick.value, tripMin.value))
const tripMode = computed(() => dest.value !== null)

const rainMarks = computed(() => {
  const c = cells.value
  const marks: { i: number; label: string; left: string }[] = []
  const firstWet = c.findIndex(x => x.wet)
  if (firstWet < 0) return marks
  const push = (i: number) => {
    if (i >= 1 && i <= c.length - 2 && !marks.some(m => Math.abs(m.i - i) < 3)) {
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
  .filter(({ start, i }) => i >= 2 && i <= 21 && clockParts(start).m % 30 === 0
    && !rainMarks.value.some(m => Math.abs(m.i - i) < 3))
  .map(({ start, i }) => ({ label: fmtHM(start), left: (i / cells.value.length) * 100 + '%' })))

function tripNote(c: TimelineCell[], horizon: string): string {
  const firstWet = c.findIndex(x => x.wet)
  if (firstWet < 0) return 'Trajet au sec quelle que soit l\'heure de départ ' + horizon + '.'
  let lastWet = c.length - 1
  while (!c[lastWet].wet) lastWet--
  if (firstWet === 0) {
    const calm = c.findIndex(x => !x.wet)
    return calm < 0
      ? 'Pluie sur le trajet quelle que soit l\'heure de départ ' + horizon + '.'
      : 'Pluie sur le trajet si tu pars maintenant, départ au sec à partir de ' + fmtHM(c[calm].start) + '.'
  }
  const from = fmtHM(c[firstWet].start)
  return lastWet === c.length - 1
    ? 'Départ au sec jusqu\'à ' + from + ', pluie sur le trajet ensuite.'
    : 'Départ au sec jusqu\'à ' + from + ', pluie sur le trajet pour un départ entre ' + from + ' et ' + fmtHM(c[lastWet].start + STEP_5MIN_MS) + '.'
}

const note = computed(() => {
  const c = cells.value
  if (!c.length) return 'Pas de données pour le moment.'
  const horizon = c.length >= 24
    ? 'sur les 2 prochaines heures'
    : 'd\'ici ' + fmtHM(c[c.length - 1].start + STEP_5MIN_MS)
  if (tripMode.value) return tripNote(c, horizon)
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
  const head = 'Pluie dans ' + fmtMinutes(mins)
  return lastWet === c.length - 1
    ? head + ', à partir de ' + fmtHM(startMs) + '.'
    : head + ', de ' + fmtHM(startMs) + ' à ' + fmtHM(c[lastWet].start + STEP_5MIN_MS) + '.'
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">{{ tripMode ? 'Si tu pars dans les 2 prochaines heures' : 'Les 2 prochaines heures' }}</h2>
    <template v-if="cells.length">
      <div class="mb-1 text-[11px] text-dim">{{ tripMode ? 'Chaque case = un départ à cette heure, couleur = la pluie la plus forte sur le trajet' : 'Chaque case = 5 min, couleur = intensité de la pluie' }}</div>
      <div class="flex h-7 gap-px overflow-hidden rounded-md desk:h-9">
        <span
          v-for="(c, i) in cells" :key="i" :title="c.title"
          class="flex-1" :style="{ background: c.color ?? 'var(--color-line)' }"
        ></span>
      </div>
      <div class="relative mt-1 h-5">
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
