<script setup lang="ts">
import { computed } from 'vue'
import { nowTick, slots, weather } from '../store'
import { dayCells, fmtDay, fmtHM, intensityColor } from '../lib/meteo'

interface HourBar {
  label: string
  bold: boolean
  demain: boolean
  proba: number
  color: string | null
  height: string
  title: string
}

const day = computed(() => dayCells(slots.value, nowTick.value))

function dayHM(tMs: number): string {
  const d = fmtDay(tMs, nowTick.value)
  return d ? d + ' ' + fmtHM(tMs) : fmtHM(tMs)
}

const bars = computed<HourBar[]>(() => {
  const cs = day.value
  const h = weather.value?.hourly
  const wetIdx = cs.findIndex(c => c.wetAt !== null)
  return cs.map((c, i) => {
    const hh = new Date(c.start).getHours()
    const demain = hh === 0
    const hi = h ? h.time.indexOf(c.start / 1000) : -1
    const proba = hi >= 0 ? h!.precipitation_probability[hi] || 0 : 0
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
      title: fmtHM(c.start) + ' : ' + c.mm.toFixed(1) + ' mm, ' + proba + ' %',
    }
  })
})

const note = computed(() => {
  const cs = day.value
  if (!cs.length) return 'Pas de données pour le moment.'
  const endMs = cs[cs.length - 1].start + 3600000
  const wetIdx = cs.findIndex(c => c.wetAt !== null)
  if (wetIdx < 0) return 'Pas de pluie prévue d\'ici ' + dayHM(endMs) + '.'
  const total = cs.reduce((a, c) => a + c.mm, 0)
  const mmTxt = total >= 10 ? Math.round(total) + ' mm' : total.toFixed(1).replace('.', ',') + ' mm'
  if (wetIdx === 0) {
    const dryIdx = cs.findIndex(c => c.wetAt === null)
    const til = dryIdx < 0 ? dayHM(endMs) : dayHM(cs[dryIdx].start)
    return 'Pluie jusqu\'à ' + til + ' environ (' + mmTxt + ' attendus).'
  }
  const t = cs[wetIdx].wetAt!
  const d = fmtDay(t, nowTick.value)
  return 'Pluie de retour ' + (d ? d + ' ' : '') + 'vers ' + fmtHM(t) + ' (' + mmTxt + ' attendus).'
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">La suite de la journée</h2>
    <template v-if="bars.length">
      <div class="mb-1 text-[11px] text-dim">Chaque barre = 1 h, après les 2 heures ci-dessus. Fond bleu pâle = probabilité de pluie</div>
      <div class="flex h-[110px] items-end gap-[3px] desk:h-[140px]">
        <div
          v-for="(c, i) in bars" :key="i" :title="c.title"
          class="relative h-full flex-1 rounded-[3px] bg-[linear-gradient(to_top,var(--color-line)_0,var(--color-line)_2px,transparent_2px)]"
        >
          <div class="absolute inset-x-0 bottom-0 rounded-t-[3px] bg-legere opacity-[.22]" :style="{ height: c.proba + '%' }"></div>
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
