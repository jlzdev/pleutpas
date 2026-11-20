import { beforeAll, describe, expect, it } from 'vitest'
import {
  bearingDeg, cleanName, clockParts, computeVerdict, coordsName, dayCells, departureMs, displayZone, distanceKm,
  estimatedTripMin, fmtConditions, fmtDay, fmtDayHM, fmtHM, fmtMinutes, fmtMm, fmtVigilance, fmtWinter, hourlyEndMs,
  inFranceBounds, intensityColor, intensityWord, isMfPointUsable, mfLevelMm, nextWetSlotMs, placeTown, radarNowMm,
  relativeWindWord, routeLabel, routeLabels, spanAt, STEP_5MIN_MS, timelineCells, timelineEndMs, tripPositions, windWord,
  winterAt, winterNote, zonedTimeMs, HOUR_MS,
  type FrameSample, type MfEntry, type MfForecast, type PointForecast, type Slot, type Trip,
} from './meteo'

const MIN = 60000
const T8 = Date.UTC(2026, 10, 20, 7, 0)
const NOW = T8 + 3 * MIN
const A = { name: 'Besançon', lat: 47.24, lon: 6.02 }
const B = { name: 'Vesoul', lat: 47.62, lon: 6.15 }

function slotsWith(wet: [number, number][] = [], fromMin = -60, toMin = 48 * 60): Slot[] {
  const out: Slot[] = []
  for (let m = fromMin; m < toMin; m += 15) {
    const w = wet.find(([at]) => at === m)
    out.push({ start: T8 + m * MIN, end: T8 + (m + 15) * MIN, mm: w ? w[1] : 0 })
  }
  return out
}

function mfWith(level = 1, levels: Record<number, number> = {}): MfEntry[] {
  const out: MfEntry[] = []
  for (let m = 5; m < 65; m += 5) {
    const l = levels[m] ?? level
    out.push({ start: T8 + m * MIN, end: T8 + (m + 5) * MIN, level: l, desc: ['', 'Temps sec', 'Pluie faible', 'Pluie modérée', 'Pluie forte'][l] })
  }
  return out
}

function tripOf(opts: Partial<Trip> & { dest?: boolean } = {}): Trip {
  const slots = opts.slots ?? [slotsWith(), slotsWith()]
  return {
    positions: tripPositions(A, opts.dest ? B : null),
    hasDest: !!opts.dest,
    mf: opts.mf ?? [null, null],
    slots,
    samples: opts.samples ?? null,
  }
}

function pointForecast(rain: Slot[], proba: { start: number; end: number; pct: number }[] = []): PointForecast {
  return { source: 'mf', timezone: 'Europe/Paris', rain, conditions: [], proba }
}

beforeAll(() => { displayZone.value = 'Europe/Paris' })

describe('heures et jours', () => {
  it('formate les heures à la française', () => {
    expect(fmtHM(T8)).toBe('8h')
    expect(fmtHM(T8 + 15 * MIN)).toBe('8h15')
    expect(fmtHM(Date.UTC(2026, 10, 20, 23, 5))).toBe('0h05')
    expect(clockParts(T8)).toMatchObject({ year: 2026, month: 11, day: 20, h: 8, m: 0, weekday: 'vendredi' })
  })
  it('nomme le jour relativement à maintenant', () => {
    expect(fmtDay(T8 + 2 * HOUR_MS, NOW)).toBe('')
    expect(fmtDay(T8 + 20 * HOUR_MS, NOW)).toBe('demain')
    expect(fmtDay(T8 + 44 * HOUR_MS, NOW)).toBe('dimanche')
    expect(fmtDayHM(T8 + 20 * HOUR_MS, NOW)).toBe('demain 4h')
    expect(fmtDayHM(T8 + 90 * MIN, NOW)).toBe('9h30')
  })
  it('durées', () => {
    expect(fmtMinutes(45)).toBe('45 min')
    expect(fmtMinutes(60)).toBe('1 h')
    expect(fmtMinutes(85)).toBe('1 h 25')
  })
  it('instant d\'une heure murale du fuseau affiché', () => {
    expect(zonedTimeMs(2026, 11, 20, 8, 0)).toBe(T8)
    expect(zonedTimeMs(2026, 7, 14, 12, 30)).toBe(Date.UTC(2026, 6, 14, 10, 30))
  })
  it('heure de départ choisie : aujourd\'hui si à venir, sinon demain, changement d\'heure compris', () => {
    expect(departureMs('09:30', NOW)).toBe(Date.UTC(2026, 10, 20, 8, 30))
    expect(departureMs('07:00', NOW)).toBe(Date.UTC(2026, 10, 21, 6, 0))
    expect(departureMs('08:03', NOW)).toBe(Date.UTC(2026, 10, 21, 7, 3))
    expect(departureMs('08:05', NOW + 90 * 1000)).toBe(T8 + 5 * MIN)
    expect(departureMs('08:00', Date.UTC(2026, 2, 28, 10, 0))).toBe(Date.UTC(2026, 2, 29, 6, 0))
    expect(departureMs('8:00', NOW)).toBeNull()
    expect(departureMs('25:00', NOW)).toBeNull()
  })
  it('fin de la frise alignée sur 5 min', () => {
    expect(timelineEndMs(NOW)).toBe(T8 + 120 * MIN)
  })
})

describe('lieux', () => {
  it('commune et rue', () => {
    expect(placeTown({ ...A, name: 'Rue battant, Besançon' })).toBe('Besançon')
    expect(routeLabels(A, B)).toEqual(['Besançon', 'Vesoul'])
    expect(routeLabels({ ...A, name: 'Rue battant, Besançon' }, { ...A, name: 'Rue de Vesoul, Besançon' })).toEqual(['Rue battant', 'Rue de Vesoul'])
    expect(routeLabel(A, null)).toBe('Besançon')
    expect(routeLabel(A, B)).toBe('Besançon vers Vesoul')
  })
  it('nettoie les noms et borne la zone', () => {
    expect(cleanName(' Vesoul\u0000\n ')).toBe('Vesoul')
    expect(cleanName('x'.repeat(80))).toHaveLength(60)
    expect(cleanName(42)).toBe('')
    expect(coordsName(47.2378, 6.0241)).toBe('47.24 6.02')
    expect(inFranceBounds(47, 6)).toBe(true)
    expect(inFranceBounds(52.5, 13.4)).toBe(false)
  })
  it('distances, durée estimée et cap', () => {
    expect(distanceKm(A, B)).toBeCloseTo(43.4, 0)
    expect(estimatedTripMin(A, B)).toBe(175)
    expect(Math.round(bearingDeg(A, B))).toBe(13)
    expect(tripPositions(A, B)).toHaveLength(25)
    expect(tripPositions(A, null)).toEqual([A])
  })
})

describe('intensités et conditions', () => {
  it('niveaux MF et palette', () => {
    expect(mfLevelMm(1)).toBe(0)
    expect(mfLevelMm(3)).toBe(0.75)
    expect(mfLevelMm(9)).toBe(5)
    expect(intensityWord(0)).toBe('sec')
    expect(intensityWord(0.05)).toBe('traces')
    expect(intensityWord(0.3)).toBe('pluie légère')
    expect(intensityColor(2)).toBe('var(--color-fort)')
    expect(intensityColor(0.01)).toBeNull()
    expect(fmtMm(5.25)).toBe('5,3 mm')
    expect(fmtMm(12.4)).toBe('12 mm')
  })
  it('vent', () => {
    expect(windWord(0)).toBe('du nord')
    expect(windWord(95)).toBe("d'est")
    expect(windWord(359)).toBe('du nord')
    expect(relativeWindWord(0, 0)).toBe('de face')
    expect(relativeWindWord(180, 0)).toBe('de dos')
    expect(relativeWindWord(90, 0)).toBe('de travers')
  })
  it('phrase des conditions', () => {
    expect(fmtConditions({ tempC: 8.4, feelsC: 7, windKmh: 6, gustKmh: 12, windFrom: 270 })).toEqual({ temp: '8 °C.', wind: 'Vent calme.', strong: false })
    expect(fmtConditions({ tempC: 8, feelsC: 5, windKmh: 22, gustKmh: 47, windFrom: 270 })).toEqual({ temp: '8 °C, ressenti 5 °C.', wind: "Vent d'ouest 20 km/h, rafales 45.", strong: false })
    expect(fmtConditions({ tempC: 8, feelsC: 8, windKmh: 40, gustKmh: 62, windFrom: null })).toEqual({ temp: '8 °C.', wind: 'Vent fort 40 km/h, rafales 60.', strong: true })
    expect(fmtConditions({ tempC: 8, feelsC: 8, windKmh: 20, gustKmh: 20, windFrom: 180 }, 0).wind).toBe('Vent de dos 20 km/h.')
  })
})

describe('séries', () => {
  it('spanAt par recherche binaire, fin exclue', () => {
    const s = slotsWith()
    expect(spanAt(s, T8)?.start).toBe(T8)
    expect(spanAt(s, T8 + 14 * MIN)?.start).toBe(T8)
    expect(spanAt(s, T8 + 15 * MIN)?.start).toBe(T8 + 15 * MIN)
    expect(spanAt(s, T8 - 2 * HOUR_MS)).toBeNull()
    expect(spanAt(s, T8 + 48 * HOUR_MS)).toBeNull()
  })
  it('zone horaire contiguë et prévision MF utilisable', () => {
    const hourly: Slot[] = []
    for (let h = -1; h < 14; h++) hourly.push({ start: T8 + h * HOUR_MS, end: T8 + (h + 1) * HOUR_MS, mm: 0 })
    hourly.push({ start: T8 + 14 * HOUR_MS, end: T8 + 17 * HOUR_MS, mm: 0 })
    expect(hourlyEndMs(hourly, NOW)).toBe(T8 + 14 * HOUR_MS)
    const fc = (country: string | null, rain: Slot[]): MfForecast => ({ dept: '25', country, hours: [], hazards: [], point: pointForecast(rain) })
    expect(isMfPointUsable(fc('FR', hourly), NOW)).toBe(true)
    expect(isMfPointUsable(fc('BE', hourly), NOW)).toBe(false)
    expect(isMfPointUsable(fc('FR', hourly.slice(0, 6)), NOW)).toBe(false)
  })
  it('prochain créneau mouillé', () => {
    const s = slotsWith([[300, 0.5]])
    expect(nextWetSlotMs(s, NOW, NOW + 48 * HOUR_MS)).toBe(T8 + 300 * MIN)
    expect(nextWetSlotMs(s, T8 + 305 * MIN, NOW + 48 * HOUR_MS)).toBe(T8 + 305 * MIN)
    expect(nextWetSlotMs(s, NOW, T8 + 200 * MIN)).toBe(-1)
  })
})

describe('verdict', () => {
  it('sec partout : OUI sans détail quand rien n\'est prévu sur 48 h', () => {
    expect(computeVerdict(tripOf({ mf: [mfWith(), null] }), 15, NOW, NOW)).toEqual({ state: 'oui', big: 'OUI', sub: 'Ça roule', detail: '' })
  })
  it('sec puis pluie dans l\'après-midi : OUI, sec jusqu\'à', () => {
    const t = tripOf({ mf: [mfWith(), null], slots: [slotsWith([[360, 1]]), slotsWith()] })
    expect(computeVerdict(t, 15, NOW, NOW).detail).toBe('Sec jusqu\'à 14h environ.')
  })
  it('pluie au deuxième pas MF seulement : prévue, pas en ce moment, comme la frise', () => {
    const t = tripOf({ mf: [mfWith(1, { 10: 3, 15: 3 }), null] })
    expect(computeVerdict(t, 15, NOW, NOW)).toMatchObject({ state: 'pluie', sub: 'Prévue vers 8h10' })
    expect(timelineCells(t, NOW, 15).findIndex((c) => c.wet)).toBe(2)
  })
  it('pluie faible MF maintenant : OUI orange avec prochain départ au sec', () => {
    const v = computeVerdict(tripOf({ mf: [mfWith(2), null] }), 15, NOW, NOW)
    expect(v).toMatchObject({ state: 'bof', big: 'OUI', sub: 'Pluie faible en ce moment', detail: 'Sinon, prochain départ au sec : 9h05.' })
  })
  it('bruine prévue : OUI orange avec son heure', () => {
    const v = computeVerdict(tripOf({ mf: [mfWith(1, { 30: 2, 35: 2 }), null] }), 60, NOW, NOW)
    expect(v.sub).toBe('Pluie faible prévue vers 8h30')
    expect(v.state).toBe('bof')
  })
  it('pluie modérée MF maintenant : PLUIE', () => {
    const v = computeVerdict(tripOf({ mf: [mfWith(3), null] }), 15, NOW, NOW)
    expect(v).toMatchObject({ state: 'pluie', big: 'PLUIE', sub: 'En ce moment', detail: 'Sinon, prochain départ au sec : 9h05.' })
  })
  it('pluie prévue au-delà de l\'heure MF : dépend de la durée du trajet', () => {
    const t = tripOf({ mf: [mfWith(), null], slots: [slotsWith([[90, 2]]), slotsWith()] })
    expect(computeVerdict(t, 15, NOW, NOW)).toMatchObject({ state: 'oui', detail: 'Sec jusqu\'à 9h30 environ.' })
    expect(computeVerdict(t, 120, NOW, NOW)).toMatchObject({ state: 'pluie', sub: 'Prévue vers 9h30', detail: 'Sinon, prochain départ au sec : 9h45.' })
  })
  it('MF muet : la lame d\'eau radar confirmée fait foi, un parasite isolé non', () => {
    const wet: FrameSample[] = [{ time: NOW - 10 * MIN, past: true, mm: [2] }, { time: NOW - 5 * MIN, past: true, mm: [2] }]
    expect(computeVerdict(tripOf({ samples: wet }), 15, NOW, NOW)).toMatchObject({ state: 'pluie', sub: 'En ce moment, vue au radar', detail: 'Averse non prévue, reviens voir quand elle passe.' })
    const glitch: FrameSample[] = [{ time: NOW - 10 * MIN, past: true, mm: [0] }, { time: NOW - 5 * MIN, past: true, mm: [2] }]
    expect(computeVerdict(tripOf({ samples: glitch }), 15, NOW, NOW).state).toBe('oui')
    expect(radarNowMm(wet)).toBe(2)
    expect(radarNowMm(glitch)).toBe(0)
    expect(radarNowMm(null)).toBeNull()
    const drizzle: FrameSample[] = [{ time: NOW - 10 * MIN, past: true, mm: [0.3] }, { time: NOW - 5 * MIN, past: true, mm: [0.3] }]
    expect(computeVerdict(tripOf({ samples: drizzle }), 15, NOW, NOW)).toMatchObject({ state: 'bof', sub: 'Pluie faible en ce moment' })
  })
  it('données anciennes ou absentes', () => {
    expect(computeVerdict(tripOf(), 15, NOW, NOW - 2 * HOUR_MS).sub).toBe('Données trop anciennes')
    expect(computeVerdict(tripOf({ slots: [[], []] }), 15, NOW, NOW).sub).toBe('Pas de données')
    expect(computeVerdict(tripOf({ slots: [slotsWith([], -60, 60), slotsWith()] }), 15, NOW, NOW, NOW + 10 * HOUR_MS).sub).toBe('Pas de prévision si loin')
  })
  it('heure de départ choisie : le verdict se cale dessus, le radar et MF ne comptent plus', () => {
    const t = tripOf({ mf: [mfWith(3), null], slots: [slotsWith([[600, 1]]), slotsWith()] })
    const v = computeVerdict(t, 15, NOW, NOW, NOW + 10 * HOUR_MS)
    expect(v).toMatchObject({ state: 'pluie', sub: 'Au départ', detail: 'Sinon, prochain départ au sec : 18h15.' })
    expect(computeVerdict(t, 15, NOW, NOW, NOW + 9 * HOUR_MS)).toMatchObject({ state: 'oui', detail: 'Sec jusqu\'à 18h environ.' })
    const tomorrow = computeVerdict(tripOf({ slots: [slotsWith([[24 * 60 + 420, 2]]), slotsWith()] }), 15, NOW, NOW, T8 + 24 * HOUR_MS + 410 * MIN)
    expect(tomorrow).toMatchObject({ state: 'pluie', sub: 'Prévue vers demain 15h' })
  })
  it('trajet : pluie à l\'arrivée lue dans MF de l\'arrivée, départ au sec cohérent', () => {
    const t = tripOf({ dest: true, mf: [mfWith(1), mfWith(3)] })
    const v = computeVerdict(t, 20, NOW, NOW)
    expect(v).toMatchObject({ state: 'pluie', sub: 'Prévue vers 8h23 à l\'arrivée', detail: 'Sinon, prochain départ au sec : 8h50.' })
    const cells = timelineCells(t, NOW, 20)
    expect(cells[0].wet).toBe(true)
    expect(cells.find((c) => !c.wet)?.start).toBe(T8 + 50 * MIN)
  })
  it('trajet : pluie au premier pas MF du départ, verdict et frise d\'accord', () => {
    const t = tripOf({ dest: true, mf: [mfWith(3), mfWith(1)] })
    expect(computeVerdict(t, 20, NOW, NOW)).toMatchObject({ state: 'pluie', sub: 'En ce moment' })
    expect(timelineCells(t, NOW, 20)[0].wet).toBe(true)
    expect(computeVerdict(t, 20, T8 + 1 * MIN, NOW)).toMatchObject({ state: 'pluie', sub: 'En ce moment' })
  })
  it('trajet : pluie en route lue dans les images', () => {
    const samples: FrameSample[] = []
    for (let m = -10; m <= 60; m += 5) {
      const mm = Array.from({ length: 25 }, (_, i) => (i === 12 && m === 15 ? 2 : 0))
      samples.push({ time: T8 + m * MIN, past: m <= 0, mm })
    }
    const v = computeVerdict(tripOf({ dest: true, mf: [mfWith(1), mfWith(1)], samples }), 20, NOW, NOW)
    expect(v).toMatchObject({ state: 'pluie', sub: 'Prévue vers 8h15 en route' })
  })
  it('série vide à une extrémité du trajet : données incomplètes plutôt qu\'un faux verdict', () => {
    const v = computeVerdict(tripOf({ dest: true, slots: [slotsWith(), []] }), 20, NOW, NOW)
    expect(v.sub).toBe('Données incomplètes')
  })
})

describe('frise des 2 prochaines heures', () => {
  it('24 cases de 5 min, MF prioritaire sur la prévision', () => {
    const cells = timelineCells(tripOf({ mf: [mfWith(1, { 20: 3 }), null], slots: [slotsWith([[0, 2], [75, 0.5]]), slotsWith()] }), NOW, 15)
    expect(cells).toHaveLength(24)
    expect(cells[0]).toMatchObject({ start: T8, wet: true, color: 'var(--color-fort)' })
    expect(cells[1].wet).toBe(false)
    expect(cells[4]).toMatchObject({ wet: true, title: '8h20 à 8h25 : pluie modérée (Météo-France pluie dans l\'heure)' })
    expect(cells[13].wet).toBe(false)
    expect(cells[15]).toMatchObject({ wet: true, title: '9h15 à 9h20 : pluie légère, 0,5 mm par quart d\'heure' })
  })
  it('s\'arrête à la fin des données', () => {
    expect(timelineCells(tripOf({ slots: [slotsWith([], -60, 60), slotsWith()] }), NOW, 15)).toHaveLength(12)
  })
})

describe('suite de la journée', () => {
  it('24 heures à partir de la fin de la frise, cumuls et probabilité par tranche', () => {
    const rain = slotsWith([[240, 1], [255, 0.5], [600, 0.05]])
    const proba = [{ start: T8 + 2 * HOUR_MS, end: T8 + 5 * HOUR_MS, pct: 70 }]
    const cells = dayCells(pointForecast(rain, proba), NOW)
    expect(cells).toHaveLength(24)
    expect(cells[0].start).toBe(T8 + 2 * HOUR_MS)
    expect(cells[2]).toMatchObject({ mm: 1.5, maxMm15: 1, wetAt: T8 + 240 * MIN, pct: 70, probaStart: T8 + 2 * HOUR_MS })
    expect(cells[3]).toMatchObject({ mm: 0, pct: 0, probaStart: T8 + 5 * HOUR_MS })
    expect(cells[8]).toMatchObject({ wetAt: null, maxMm15: 0.05 })
  })
  it('coupe à la première heure incomplète', () => {
    expect(dayCells(pointForecast(slotsWith([], -60, 300)), NOW)).toHaveLength(3)
    expect(dayCells(null, NOW)).toEqual([])
  })
})

describe('hiver et vigilance', () => {
  const hour = (startMin: number, desc: string, snowCm = 0) => ({ start: T8 + startMin * MIN, end: T8 + (startMin + 60) * MIN, snowCm, desc })
  const fc = (hours: ReturnType<typeof hour>[], hazards: { start: number; end: number; freezingPct: number }[] = []): MfForecast =>
    ({ dept: '25', country: 'FR', hours, hazards, point: pointForecast(slotsWith()) })
  it('neige et pluie verglaçante dans les 2 h, priorité au verglas', () => {
    expect(fmtWinter(winterAt(fc([hour(-60, 'Neige'), hour(0, 'Neige')]), NOW)!, NOW)).toEqual({ text: 'Neige en ce moment.', strong: false })
    expect(fmtWinter(winterAt(fc([hour(0, 'Pluie'), hour(60, 'Neige faible', 0.4)]), NOW)!, NOW)).toEqual({ text: 'Neige vers 9h.', strong: false })
    expect(fmtWinter(winterAt(fc([hour(0, 'Neige'), hour(60, 'Pluie verglaçante')]), NOW)!, NOW)).toEqual({ text: 'Pluie verglaçante vers 9h.', strong: true })
    expect(winterAt(fc([hour(180, 'Neige')]), NOW)).toBeNull()
  })
  it('risque de verglas selon le pourcentage', () => {
    const hz = (pct: number) => [{ start: T8 - HOUR_MS, end: T8 + 2 * HOUR_MS, freezingPct: pct }]
    expect(winterAt(fc([], hz(20)), NOW)).toBeNull()
    expect(fmtWinter(winterAt(fc([], hz(45)), NOW)!, NOW)).toEqual({ text: 'Risque de verglas 45 % (Météo-France).', strong: false })
    expect(fmtWinter(winterAt(fc([], hz(70)), NOW)!, NOW).strong).toBe(true)
  })
  it('heure de départ choisie : la fenêtre hiver suit le départ', () => {
    const w = winterAt(fc([hour(600, 'Neige')]), NOW + 10 * HOUR_MS)!
    expect(fmtWinter(w, NOW)).toEqual({ text: 'Neige vers 18h03.', strong: false })
  })
  it('note du trajet : la pire des deux extrémités', () => {
    const a = fc([hour(0, 'Neige')])
    const b = fc([hour(0, 'Pluie verglaçante')])
    expect(winterNote(a, b, true, NOW)?.text).toBe('Pluie verglaçante à l\'arrivée en ce moment.')
    expect(winterNote(a, b, false, NOW)?.text).toBe('Neige en ce moment.')
    expect(winterNote(a, null, true, NOW)?.text).toBe('Neige au départ en ce moment.')
    expect(winterNote(null, null, true, NOW)).toBeNull()
  })
  it('vigilance par phénomène, la plus sévère en premier', () => {
    expect(fmtVigilance(null)).toBeNull()
    expect(fmtVigilance({ today: { '5': 1 }, tomorrow: { '5': 1 } })).toBeNull()
    expect(fmtVigilance({ today: { '5': 2 }, tomorrow: {} })).toEqual({ text: 'Vigilance jaune neige-verglas.', strong: false })
    expect(fmtVigilance({ today: { '5': 3 }, tomorrow: { '5': 2 } })).toEqual({ text: 'Vigilance orange neige-verglas.', strong: true })
    expect(fmtVigilance({ today: { '5': 2 }, tomorrow: { '5': 3 } })).toEqual({ text: 'Vigilance jaune neige-verglas, demain orange neige-verglas.', strong: true })
    expect(fmtVigilance({ today: { '5': 1 }, tomorrow: { '5': 4 } })).toEqual({ text: 'Vigilance demain rouge neige-verglas.', strong: true })
    expect(fmtVigilance({ today: { '1': 2, '3': 3, '9': 4 }, tomorrow: { '2': 2 } })).toEqual({ text: 'Vigilance orange orages, jaune vent violent, demain jaune pluie-inondation.', strong: true })
    expect(fmtVigilance({ today: { '2': 2 }, tomorrow: { '1': 2 } })?.text).toBe('Vigilance jaune pluie-inondation, demain jaune vent violent.')
    expect(fmtVigilance({ today: { '1': 2, '3': 3 }, tomorrow: { '1': 3, '3': 3 } })?.text).toBe('Vigilance orange orages, jaune vent violent, demain orange vent violent.')
  })
})

describe('échantillons et pas de 5 min', () => {
  it('constantes', () => {
    expect(STEP_5MIN_MS).toBe(5 * MIN)
  })
})
