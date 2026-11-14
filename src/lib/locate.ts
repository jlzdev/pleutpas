import { onBeforeUnmount, ref } from 'vue'
import { setPlace } from '../store'
import { reverseGeocodeName } from './api'
import { inFranceBounds } from './meteo'

export const geolocSupported = 'geolocation' in navigator

export function useLocate() {
  const locating = ref(false)
  const message = ref('')
  let seq = 0

  function cancel(): void {
    seq++
    locating.value = false
    message.value = ''
  }

  function locateMe(): void {
    if (locating.value) return
    const mine = ++seq
    locating.value = true
    message.value = 'Localisation...'
    navigator.geolocation.getCurrentPosition(async (pos) => {
      if (mine !== seq) return
      const lat = Math.round(pos.coords.latitude * 1000) / 1000
      const lon = Math.round(pos.coords.longitude * 1000) / 1000
      if (!inFranceBounds(lat, lon)) {
        locating.value = false
        message.value = 'Position hors de la zone couverte (France et pays voisins).'
        return
      }
      let name: string | null = null
      try { name = await reverseGeocodeName(lat, lon) } catch { /* nom facultatif */ }
      if (mine !== seq) return
      locating.value = false
      message.value = ''
      setPlace({ name: name ?? 'Ma position', lat, lon })
    }, (err) => {
      if (mine !== seq) return
      locating.value = false
      message.value = err.code === err.PERMISSION_DENIED
        ? 'Géolocalisation refusée (autorise-la dans le navigateur, et il faut du HTTPS).'
        : 'Position introuvable pour le moment.'
    }, { timeout: 10000, maximumAge: 60000 })
  }

  onBeforeUnmount(cancel)
  return { locating, message, locateMe, cancel }
}
