import { onBeforeUnmount, ref } from 'vue'
import { setPlace } from '../store'
import { reverseGeocodeName } from './api'
import { inFranceBounds } from './meteo'

export const geolocSupported = 'geolocation' in navigator
const STORED_DECIMALS = 3

export function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((pos) => {
      const lat = pos.coords.latitude
      const lon = pos.coords.longitude
      if (inFranceBounds(lat, lon)) resolve({ lat, lon })
      else reject(new Error('Position hors de la zone couverte (France et pays voisins).'))
    }, (err) => {
      reject(new Error(err.code === err.PERMISSION_DENIED
        ? 'Géolocalisation refusée (autorise-la dans le navigateur, et il faut du HTTPS).'
        : 'Position introuvable pour le moment.'))
    }, { timeout: 10000, maximumAge: 60000 })
  })
}

export function locateError(e: unknown): string {
  return e instanceof Error ? e.message : 'Position introuvable pour le moment.'
}

export function useLocate() {
  const locating = ref(false)
  const message = ref('')
  let seq = 0

  function cancel(): void {
    seq++
    locating.value = false
    message.value = ''
  }

  async function locateMe(): Promise<void> {
    if (locating.value) return
    const mine = ++seq
    locating.value = true
    message.value = 'Localisation...'
    try {
      const pos = await getPosition()
      const lat = Number(pos.lat.toFixed(STORED_DECIMALS))
      const lon = Number(pos.lon.toFixed(STORED_DECIMALS))
      const name = await reverseGeocodeName(lat, lon)
      if (mine !== seq) return
      locating.value = false
      message.value = ''
      setPlace({ name: name ?? 'Ma position', lat, lon })
    } catch (e) {
      if (mine !== seq) return
      locating.value = false
      message.value = locateError(e)
    }
  }

  onBeforeUnmount(cancel)
  return { locating, message, locateMe, cancel }
}
