import { ref } from 'vue'

export interface Toast {
  text: string
  action?: { label: string; run: () => void }
}

const TOAST_MS = 7000

export const toast = ref<Toast | null>(null)
let timer = 0

export function hideToast(): void {
  clearTimeout(timer)
  toast.value = null
}

export function showToast(t: Toast): void {
  clearTimeout(timer)
  toast.value = t
  timer = window.setTimeout(hideToast, TOAST_MS)
}
