<script setup lang="ts">
import { computed } from 'vue'
import { dest, forecast, nowTick } from '../store'
import { clockParts, dayCells, fmtDay, fmtDayHM, fmtHM, fmtMm, intensityColor } from '../lib/meteo'

interface HourBar {
  label: string
  bold: boolean
  demain: boolean
  proba: number
  color: string | null
  height: string
  title: string
}

const day = computed(() => dayCells(forecast.value, nowTick.value))
// la probabilite Meteo-France est par tranche de 3 h et par paliers de 10 %, souvent a 100 % sous
// la pluie : plafonnee a 60 % de la hauteur pour ne pas masquer le relief des cumuls
const PROBA_MAX_HEIGHT = 60
const probaNote = computed(() => (forecast.value?.source === 'mf' ? ' (Météo-France, par tranche de 3 h)' : forecast.value ? ' (Open-Meteo, par heure)' : ''))

const bars = computed<HourBar[]>(() => {
  const cs = day.value
  const wetIdx = cs.findIndex(c => c.wetAt !== null)
  return cs.map((c, i) => {
    const hh = clockParts(c.start).h
    const demain = hh === 0
    const proba = c.pct
    const bold = i === wetIdx
    let label = ''
    if (bold) label = fmtHM(c.wetAt!)
    else if (wetIdx >= 0 && Math.abs(i - wetIdx) <= (demain ? 2 : 1)) label = ''
    else if (demain) label = fmtDay(c.start, nowTick.value)
    else if (i % 3 === 0) label = hh + 'h'
    return {
      label,
      bold,
      demain,
      proba,
      color: intensityColor(c.mm / 4),
      height: Math.min(100, 10 + (c.mm / 6) * 90) + '%',
      title: fmtHM(c.start) + ' à ' + fmtHM(c.start + 3600000) + ' : '
        + (c.wetAt !== null ? fmtMm(c.mm) + ' de pluie' : 'pas de pluie') + ', probabilité ' + proba + ' %',
    }
  })
})

const note = computed(() => {
  const cs = day.value
  if (!cs.length) return 'Pas de données pour le moment.'
  const endMs = cs[cs.length - 1].start + 3600000
  const wetIdx = cs.findIndex(c => c.wetAt !== null)
  if (wetIdx < 0) return 'Pas de pluie prévue d\'ici ' + fmtDayHM(endMs, nowTick.value) + '.'
  const total = cs.reduce((a, c) => a + c.mm, 0)
  const mmTxt = fmtMm(total)
  if (wetIdx === 0) {
    const dryIdx = cs.findIndex(c => c.wetAt === null)
    const til = dryIdx < 0 ? fmtDayHM(endMs, nowTick.value) : fmtDayHM(cs[dryIdx].start, nowTick.value)
    return 'Pluie jusqu\'à ' + til + ' environ (' + mmTxt + ' attendus).'
  }
  const t = cs[wetIdx].wetAt!
  const d = fmtDay(t, nowTick.value)
  return 'Pluie de retour ' + (d ? d + ' ' : '') + 'vers ' + fmtHM(t) + ' (' + mmTxt + ' attendus).'
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">La suite de la journée{{ dest ? ' au départ' : '' }}</h2>
    <template v-if="bars.length">
      <div class="mb-1 text-[11px] text-dim">Chaque barre = 1 h, après les 2 heures ci-dessus. Fond bleu pâle = probabilité de pluie{{ probaNote }}</div>
      <div class="flex h-[110px] items-end gap-[3px] desk:h-[140px]">
        <div
          v-for="(c, i) in bars" :key="i" :title="c.title"
          class="relative h-full flex-1 rounded-[3px] bg-[linear-gradient(to_top,var(--color-line)_0,var(--color-line)_2px,transparent_2px)]"
        >
          <div class="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-legere opacity-[.22]" :style="{ height: Math.round(c.proba * PROBA_MAX_HEIGHT / 100) + '%' }"></div>
          <div
            v-if="c.color" class="absolute bottom-0 left-[15%] right-[15%] rounded-t-[3px]"
            :style="{ background: c.color, height: c.height }"
          ></div>
        </div>
      </div>
      <div class="mt-1.5 flex gap-[3px]">
        <div
          v-for="(c, i) in bars" :key="i"
          class="flex-1 whitespace-nowrap text-center text-[9px] desk:text-[11px]"
          :class="c.bold ? 'font-bold text-ink' : (c.demain ? 'text-bruine' : 'text-dim')"
        >{{ c.label }}</div>
      </div>
    </template>
    <div class="mt-2 text-[13px] desk:text-sm" :class="day.some(c => c.wetAt !== null) ? 'text-ink' : 'text-dim'">{{ note }}</div>
  </section>
</template>
