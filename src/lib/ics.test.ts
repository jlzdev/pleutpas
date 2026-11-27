import { describe, expect, it } from 'vitest'
import { buildReminderIcs, reminderLabel } from './ics'

const HOME = { name: 'Besançon', lat: 47.24, lon: 6.02 }

describe('rappel agenda', () => {
  it('sonne 15 min avant le départ', () => {
    expect(reminderLabel('08:00')).toBe('7h45')
    expect(reminderLabel('00:10')).toBe('23h55')
  })
  it('commence un jour ouvré, même ajouté un samedi', () => {
    const ics = buildReminderIcs(HOME, '08:00', new Date(2026, 10, 28, 10, 0))
    expect(ics).toContain('DTSTART:20261130T074500')
    expect(ics).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')
    expect(buildReminderIcs(HOME, '08:00', new Date(2026, 10, 27, 10, 0))).toContain('DTSTART:20261127T074500')
  })
  it('échappe les points-virgules et les virgules du lieu', () => {
    const ics = buildReminderIcs({ ...HOME, name: 'Rue a; b, Besançon' }, '08:00', new Date(2026, 10, 27, 10, 0))
    expect(ics?.replace(/\r\n /g, '')).toContain('depuis Besançon')
    const odd = buildReminderIcs({ ...HOME, name: 'A;B' }, '08:00', new Date(2026, 10, 27, 10, 0))
    expect(odd?.replace(/\r\n /g, '')).toContain('depuis A\\;B.')
  })
  it('refuse une heure invalide', () => {
    expect(buildReminderIcs(HOME, '25:00')).toBeNull()
  })
})
