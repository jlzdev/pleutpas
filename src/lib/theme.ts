import { ref } from 'vue'
import { lsGet, lsSet } from '../store'

export type Theme = 'auto' | 'light' | 'dark'

const KEY = 'pleutpas.theme'
const COLORS = { light: '#eef2f7', dark: '#0e1420' }
const lightMedia = matchMedia('(prefers-color-scheme: light)')

function read(): Theme {
  const v = lsGet(KEY)
  return v === 'light' || v === 'dark' ? v : 'auto'
}

export const theme = ref<Theme>(read())

export function effectiveTheme(): 'light' | 'dark' {
  return theme.value === 'auto' ? (lightMedia.matches ? 'light' : 'dark') : theme.value
}

function apply(): void {
  const root = document.documentElement
  if (theme.value === 'auto') delete root.dataset.theme
  else root.dataset.theme = theme.value
  const color = COLORS[effectiveTheme()]
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}

export function setTheme(t: Theme): void {
  theme.value = t
  lsSet(KEY, t)
  apply()
}

export function initTheme(): void {
  apply()
  lightMedia.addEventListener('change', apply)
}
