import { beforeAll, describe, expect, it } from 'vitest'
import { displayZone } from './meteo'
import { dayNumber, daylightAt, sunEvents, sunNote } from './sun'

const PARIS = { name: 'Paris', lat: 48.8566, lon: 2.3522 }
const BESANCON = { name: 'Besançon', lat: 47.24, lon: 6.02 }
const MIN = 60000
const near = (a: number, b: number, tolMin = 6) => Math.abs(a - b) <= tolMin * MIN

beforeAll(() => { displayZone.value = 'Europe/Paris' })

describe('soleil', () => {
  it('lever et coucher à Paris au solstice d\'été', () => {
    const n = dayNumber(Date.UTC(2026, 5, 21, 12))
    expect(n).toBe(dayNumber(Date.UTC(2026, 5, 21, 0, 30)))
    expect(n).toBe(dayNumber(Date.UTC(2026, 5, 20, 23, 30)) + 1)
    const e = sunEvents(PARIS.lat, PARIS.lon, n)!
    expect(near(e.rise, Date.UTC(2026, 5, 21, 3, 47))).toBe(true)
    expect(near(e.set, Date.UTC(2026, 5, 21, 19, 58))).toBe(true)
  })
  it('jour ou nuit et prochaine transition', () => {
    const noon = daylightAt(PARIS.lat, PARIS.lon, Date.UTC(2026, 5, 21, 12))!
    expect(noon.dark).toBe(false)
    expect(near(noon.next, Date.UTC(2026, 5, 21, 19, 58))).toBe(true)
    const night = daylightAt(PARIS.lat, PARIS.lon, Date.UTC(2026, 5, 21, 23))!
    expect(night.dark).toBe(true)
    expect(near(night.next, Date.UTC(2026, 5, 22, 3, 47))).toBe(true)
    expect(daylightAt(80, 20, Date.UTC(2026, 5, 21, 12))).toBeNull()
  })
  it('note sous le verdict : nuit au départ, nuit pendant le trajet, rien en plein jour', () => {
    const now = Date.UTC(2026, 10, 20, 6, 0)
    expect(sunNote(BESANCON, now, 15, now)?.text).toMatch(/^Nuit jusqu'à 7h[45]\d\.$/)
    const afternoon = Date.UTC(2026, 10, 20, 15, 30)
    expect(sunNote(BESANCON, afternoon, 15, now)?.text).toMatch(/^Nuit à 1[67]h\d\d\.$/)
    expect(sunNote(BESANCON, Date.UTC(2026, 10, 20, 11, 0), 15, now)).toBeNull()
    expect(sunNote(BESANCON, Date.UTC(2026, 10, 21, 6, 0), 15, now)?.text).toMatch(/^Nuit jusqu'à demain 7h/)
  })
})
