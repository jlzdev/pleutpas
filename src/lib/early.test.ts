import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import api from './api.ts?raw'
import { FRANCE_BOUNDS } from './meteo'

const urlParts = (src: string, path: string, tail: string) => {
  const re = new RegExp("'(https://webservice\\.meteofrance\\.com/" + path + "\\?lat=)'\\s*\\+\\s*\\w+\\.lat\\s*\\+\\s*'(&lon=)'\\s*\\+\\s*\\w+\\.lon\\s*\\+\\s*'(" + tail + ")'")
  const m = re.exec(src)
  return m ? m.slice(1) : null
}

describe('script inline de préchargement', () => {
  it('utilise le même jeton public que api.ts', () => {
    const token = /const MF_TOKEN = '([^']+)'/.exec(api)?.[1]
    expect(token).toBeTruthy()
    expect(html).toContain("var token = '" + token + "'")
  })
  it('construit les mêmes URL Météo-France que api.ts', () => {
    for (const [path, tail] of [['rain', '&token='], ['v2/forecast', '&lang=fr&token=']]) {
      const fromApi = urlParts(api, path, tail)
      expect(fromApi).not.toBeNull()
      expect(urlParts(html, path, tail)).toEqual(fromApi)
    }
  })
  it('vise les mêmes manifests que api.ts', () => {
    for (const branch of ['piaf', 'data']) {
      const base = new RegExp("'(https://raw\\.githubusercontent\\.com/jlzdev/pleutpas/" + branch + ")'").exec(api)?.[1]
      expect(base).toBeTruthy()
      expect(html).toContain("'" + base + "/manifest.json'")
    }
  })
  it('filtre la même zone que FRANCE_BOUNDS', () => {
    const [[south, west], [north, east]] = FRANCE_BOUNDS
    expect(html).toContain('p.lat >= ' + south + ' && p.lat <= ' + north + ' && p.lon >= ' + west + ' && p.lon <= ' + east)
  })
})
