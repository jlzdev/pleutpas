<script setup lang="ts">
import { computed } from 'vue'
import { nowTick, weather } from '../store'
import { fmtHM, intensityColor } from '../lib/meteo'

interface HourCell {
  label: string
  demain: boolean
  proba: number
  color: string | null
  height: string
  title: string
}

const cells = computed<HourCell[]>(() => {
  const w = weather.value
  if (!w) return []
  const h = w.hourly
  const start = h.time.findIndex(t => t * 1000 + 3600000 > nowTick.value)
  if (start < 0) return []
  const out: HourCell[] = []
  for (let i = start; i < Math.min(start + 18, h.time.length); i++) {
    const d = new Date(h.time[i] * 1000)
    const mm = h.precipitation[i] || 0
    const proba = h.precipitation_probability[i] || 0
    const hh = d.getHours()
    const color = intensityColor(mm / 4)
    out.push({
      label: hh === 0 ? 'demain' : ((i - start) % 3 === 0 ? hh + 'h' : ''),
      demain: hh === 0,
      proba,
      color,
      height: Math.min(100, 10 + (mm / 6) * 90) + '%',
      title: fmtHM(d) + ' : ' + mm.toFixed(1) + ' mm, ' + proba + ' %',
    })
  }
  return out
})
</script>

<template>
  <section class="card">
    <h2 class="hdr">La suite de la journée</h2>
    <div class="flex h-[110px] items-end gap-[3px] desk:h-[140px]">
      <div
        v-for="(c, i) in cells" :key="i" :title="c.title"
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
        v-for="(c, i) in cells" :key="i"
        class="flex-1 whitespace-nowrap text-center text-[9px] desk:text-[11px]"
        :class="c.demain ? 'text-bruine' : 'text-dim'"
      >{{ c.label }}</div>
    </div>
    <div class="mt-2 text-xs text-dim">Barre colorée = pluie prévue (mm), fond bleu pâle = probabilité de pluie.</div>
  </section>
</template>
