import { ref } from 'vue'
import { registerSW } from 'virtual:pwa-register'

const CHECK_MS = 60 * 60 * 1000

export const updateReady = ref(false)
export const updateDismissed = ref(false)
let update: ((reload?: boolean) => Promise<void>) | null = null

export function initUpdates(): void {
  update = registerSW({
    immediate: true,
    onNeedRefresh() { updateReady.value = true },
    onRegisteredSW(_url, r) {
      if (r) setInterval(() => { void r.update() }, CHECK_MS)
    },
  })
}

export function applyUpdate(): void {
  void update?.(true)
}
