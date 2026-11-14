<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { dest, forecast, nowTick } from '../store'
import { clockParts, dayCells, fmtDay, fmtDayHM, fmtHM, fmtMm, HOUR_MS, intensityColor, nextWetSlotMs } from '../lib/meteo'

type CellKind = 'sure' | 'incertain' | 'averse' | 'sec'

interface RibbonCell {
  kind: CellKind
  style: Record<string, string>
}

interface Run {
  start: number
  end: number
  pct: number
}

const SURE_PCT = 70
const SHOWER_PCT = 40
const DRY_CELL = 'var(--color-line)'
const GREY = '#8fa1b8'
const HATCH_MIX = 25
const deskQuery = window.matchMedia('(min-width: 900px)')
const desk = ref(deskQuery.matches)
const onDesk = (e: MediaQueryListEvent) => { desk.value = e.matches }
deskQuery.addEventListener('change', onDesk)
onBeforeUnmount(() => deskQuery.removeEventListener('change', onDesk))

const day = computed(() => dayCells(forecast.value, nowTick.value))
const leftOf = (i: number) => (i / 24) * 100 + '%'
const hatch = (color: string) => 'repeating-linear-gradient(135deg, color-mix(in srgb, ' + color + ' ' + HATCH_MIX + '%, ' + DRY_CELL + ') 0 2px, transparent 2px 5px)'

const cells = computed<RibbonCell[]>(() => {
  const cs = day.value
  const wetTranches = new Set(cs.filter(c => c.wetAt !== null).map(c => c.probaStart))
  return cs.map((c): RibbonCell => {
    if (c.wetAt !== null) {
      const color = intensityColor(c.maxMm15) ?? GREY
      return c.pct >= SURE_PCT
        ? { kind: 'sure', style: { background: color } }
        : { kind: 'incertain', style: { backgroundColor: DRY_CELL, backgroundImage: hatch(color) } }
    }
    if (c.pct >= SHOWER_PCT && !wetTranches.has(c.probaStart)) {
      return { kind: 'averse', style: { backgroundColor: DRY_CELL, backgroundImage: hatch('var(--color-legere)') } }
    }
    return { kind: 'sec', style: { backgroundColor: DRY_CELL } }
  })
})

const showerRuns = computed<Run[]>(() => {
  const out: Run[] = []
  cells.value.forEach((cell, i) => {
    const last = out[out.length - 1]
    if (cell.kind !== 'averse') return
    if (last && last.end === i) {
      last.end = i + 1
      last.pct = Math.max(last.pct, day.value[i].pct)
    } else {
      out.push({ start: i, end: i + 1, pct: day.value[i].pct })
    }
  })
  return out
})

const labels = computed(() => {
  const minGap = desk.value ? 5 : 12
  const out: { text: string; style: Record<string, string> }[] = []
  let lastStart = -Infinity
  for (const r of showerRuns.value) {
    if (r.start < lastStart + minGap) continue
    lastStart = r.start
    out.push({
      text: 'averses possibles (' + r.pct + '\u00a0%)',
      style: r.start > 13 ? { right: (100 - (r.end / 24) * 100) + '%' } : { left: leftOf(r.start) },
    })
  }
  return out
})

const dry = computed(() => cells.value.every(c => c.kind === 'sec'))
const midnightIdx = computed(() => day.value.findIndex(c => clockParts(c.start).h === 0))

const markers = computed(() => {
  const cs = day.value
  const minAfterFirst = desk.value ? 2 : 3
  const out: { i: number; label: string; bold: boolean; midnight: boolean }[] = []
  cs.forEach((c, i) => {
    const h = clockParts(c.start).h
    const midnight = h === 0
    if (i === 0) {
      out.push({ i, label: midnight ? 'demain' : h + 'h', bold: true, midnight })
      return
    }
    if (h % 3 !== 0 || i < minAfterFirst) return
    if (midnight) {
      const prev = out[out.length - 1]
      if (prev && !prev.bold && i - prev.i < 3) out.pop()
      out.push({ i, label: 'demain', bold: true, midnight: true })
      return
    }
    const prev = out[out.length - 1]
    if (!desk.value && prev?.midnight && i - prev.i <= 3) return
    out.push({ i, label: h + 'h', bold: false, midnight: false })
  })
  return out
})

const note = computed(() => {
  const cs = day.value
  if (!cs.length) return 'Pas de données pour le moment.'
  const endMs = cs[cs.length - 1].start + HOUR_MS
  const wetIdx = cs.findIndex(c => c.wetAt !== null)
  if (wetIdx < 0) {
    const run = showerRuns.value[0]
    if (run) {
      if (run.start === 0 && run.end === cs.length) return 'Averses possibles sur toute la période, sans cumul notable.'
      const endRun = run.end < cs.length ? cs[run.end].start : endMs
      return 'Averses possibles entre ' + fmtDayHM(cs[run.start].start, nowTick.value) + ' et ' + fmtDayHM(endRun, nowTick.value) + ', sans cumul notable.'
    }
    const next = forecast.value ? nextWetSlotMs(forecast.value.rain, endMs, nowTick.value + 48 * HOUR_MS) : -1
    return 'Pas de pluie prévue d\'ici ' + fmtDayHM(endMs, nowTick.value)
      + (next >= 0 ? ', prochaine pluie vers ' + fmtDayHM(next, nowTick.value) + '.' : '.')
  }
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
    <template v-if="cells.length">
      <div v-if="labels.length" class="relative h-5">
        <span v-for="l in labels" :key="l.text + l.style.left + l.style.right" class="absolute bottom-1 whitespace-nowrap text-[12px] leading-[14px] text-dim" :style="l.style">{{ l.text }}</span>
      </div>
      <div
        class="flex gap-px overflow-hidden rounded-md" :class="dry ? 'h-2' : 'h-7 desk:h-9'"
        role="img" :aria-label="note"
      >
        <div v-for="(c, i) in cells" :key="i" class="flex-1" :style="c.style"></div>
      </div>
      <div class="relative mt-1 h-4">
        <span
          v-if="midnightIdx > 0" class="absolute bottom-0 w-[2px] bg-dim" :class="dry ? '-top-[15px]' : '-top-[35px] desk:-top-[43px]'"
          :style="{ left: 'calc(' + leftOf(midnightIdx) + ' - 1px)' }"
        ></span>
        <span
          v-for="m in markers" :key="m.i"
          class="absolute top-0.5 whitespace-nowrap text-[11px] leading-[14px]"
          :class="[m.bold ? 'font-bold text-ink' : 'text-dim', m.midnight && m.i > 0 ? 'pl-1' : '']"
          :style="{ left: leftOf(m.i) }"
        >{{ m.label }}</span>
      </div>
    </template>
    <div class="mt-2.5 text-[15px] leading-5 text-ink [text-wrap:pretty]">{{ note }}</div>
  </section>
</template>
