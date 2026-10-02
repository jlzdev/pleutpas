import { ref } from 'vue'
import { lsGet, lsSet } from '../store'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'hidden' | 'android' | 'ios'

const KEY_DISMISSED = 'pleutpas.installDismissed'

export const installState = ref<InstallState>('hidden')
let deferred: BeforeInstallPromptEvent | null = null

function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function initInstall(): void {
  if (isStandalone() || lsGet(KEY_DISMISSED) === '1') return
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    installState.value = 'android'
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installState.value = 'hidden'
  })
  if (isIos()) installState.value = 'ios'
}

export async function promptInstall(): Promise<void> {
  const ev = deferred
  if (!ev) return
  deferred = null
  installState.value = 'hidden'
  try {
    await ev.prompt()
    const choice = await ev.userChoice
    if (choice.outcome === 'dismissed') lsSet(KEY_DISMISSED, '1')
  } catch { /* invite refusee par le navigateur */ }
}

export function dismissInstall(): void {
  installState.value = 'hidden'
  lsSet(KEY_DISMISSED, '1')
}
