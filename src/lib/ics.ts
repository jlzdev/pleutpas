import type { Place } from './meteo'

export const REMINDER_LEAD_MIN = 15
const CRLF = '\r\n'
const bytes = new TextEncoder()

export function parseHHMM(v: string): [number, number] | null {
  const m = /^(\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return [h, min]
}

export function reminderMs(hhmm: string): number | null {
  const hm = parseHHMM(hhmm)
  if (!hm) return null
  const total = (hm[0] * 60 + hm[1] - REMINDER_LEAD_MIN + 1440) % 1440
  return new Date(2000, 0, 1, Math.floor(total / 60), total % 60).getTime()
}

const pad = (n: number) => String(n).padStart(2, '0')

const escapeText = (s: string) => s
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\;')
  .replace(/,/g, '\\,')
  .replace(/\n/g, '\\n')

function fold(line: string): string {
  const out: string[] = []
  let cur = ''
  for (const ch of line) {
    if (bytes.encode(cur + ch).length > 74) {
      out.push(cur)
      cur = ' ' + ch
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out.join(CRLF)
}

export function placeUrl(place: Place): string {
  return 'https://pleutpas.fr/?lat=' + place.lat + '&lon=' + place.lon + '&nom=' + encodeURIComponent(place.name)
}

// evenement en heure locale flottante (sans fuseau) : l'agenda du telephone sonne a la meme
// heure murale toute l'annee, ete comme hiver, sans composant VTIMEZONE
export function buildReminderIcs(place: Place, hhmm: string, now = new Date()): string | null {
  const startMs = reminderMs(hhmm)
  const hm = parseHHMM(hhmm)
  if (startMs === null || !hm) return null
  const start = new Date(startMs)
  const url = placeUrl(place)
  const date = String(now.getFullYear()) + pad(now.getMonth() + 1) + pad(now.getDate())
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const departure = String(hm[0]) + 'h' + (hm[1] ? pad(hm[1]) : '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//pleutpas.fr//Rappel velo//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:rappel-' + place.lat + '-' + place.lon + '-' + hhmm.replace(':', '') + '@pleutpas.fr',
    'DTSTAMP:' + stamp,
    'DTSTART:' + date + 'T' + pad(start.getHours()) + pad(start.getMinutes()) + '00',
    'DURATION:PT' + REMINDER_LEAD_MIN + 'M',
    'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
    'SUMMARY:' + escapeText('Pleut pas ? Vérifie la pluie avant de partir'),
    'DESCRIPTION:' + escapeText('Départ à ' + departure + ' depuis ' + place.name + '.\n' + url),
    'URL:' + url,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:PT0S',
    'DESCRIPTION:' + escapeText('Pleut pas ? Vérifie la pluie avant de partir'),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.map(fold).join(CRLF) + CRLF
}

export function downloadIcs(ics: string, filename: string): void {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}
