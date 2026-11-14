import { computed, onBeforeUnmount, ref } from 'vue'
import type { Map as LeafletMap } from 'leaflet'
import { dest, place, setDest, setPlace } from '../store'
import { reverseGeocodeName } from './api'
import { coordsName, inFranceBounds, type Place } from './meteo'

export const PICK_ZOOM = 13
const PICK_DEBOUNCE_MS = 400
const RESOLVE_TIMEOUT_MS = 8000
const PICK_DECIMALS = 4
const NEAR_LAT = 0.0001
const NEAR_LON = 0.00015

type Spot = { lat: number; lon: number }
type Action = 'start' | 'dest'

const round = (v: number) => Number(v.toFixed(PICK_DECIMALS))

export function nearSpot(p: Spot | null, s: Spot): boolean {
  return !!p && Math.abs(p.lat - s.lat) < NEAR_LAT && Math.abs(p.lon - s.lon) < NEAR_LON
}

export function usePickOnMap() {
  const picking = ref(false)
  const resolving = ref(false)
  const pending = ref<Action | null>(null)
  const name = ref<string | null>(null)
  const outside = ref(false)
  const at = ref<Spot>({ lat: 0, lon: 0 })
  const canStart = computed(() => !outside.value && !nearSpot(place.value, at.value) && !nearSpot(dest.value, at.value))
  const canDest = computed(() => !outside.value && !nearSpot(place.value, at.value) && !nearSpot(dest.value, at.value))
  let map: LeafletMap | null = null
  let timer = 0
  let seq = 0
  let controller: AbortController | null = null

  async function resolve(): Promise<void> {
    const mine = ++seq
    const ctl = new AbortController()
    controller = ctl
    const deadline = window.setTimeout(() => ctl.abort(), RESOLVE_TIMEOUT_MS)
    const found = await reverseGeocodeName(at.value.lat, at.value.lon, ctl.signal)
    clearTimeout(deadline)
    if (mine !== seq) return
    name.value = found
    resolving.value = false
    const action = pending.value
    pending.value = null
    if (action === 'start') useAsStart()
    else if (action === 'dest') useAsDest()
  }

  function onMoveEnd(): void {
    if (!map) return
    const c = map.getCenter()
    const spot = { lat: round(c.lat), lon: round(c.lng) }
    if (nearSpot(at.value, spot)) return
    at.value = spot
    clearTimeout(timer)
    controller?.abort()
    seq++
    pending.value = null
    name.value = null
    outside.value = !inFranceBounds(spot.lat, spot.lon)
    if (outside.value) {
      resolving.value = false
      return
    }
    resolving.value = true
    timer = window.setTimeout(() => { void resolve() }, PICK_DEBOUNCE_MS)
  }

  function enter(m: LeafletMap, from: Place | null): void {
    map = m
    if (from) m.setView([from.lat, from.lon], Math.max(m.getZoom(), PICK_ZOOM), { animate: false })
    const c = m.getCenter()
    at.value = { lat: round(c.lat), lon: round(c.lng) }
    name.value = from?.name ?? null
    outside.value = !inFranceBounds(at.value.lat, at.value.lon)
    resolving.value = !from && !outside.value
    pending.value = null
    picking.value = true
    m.on('moveend', onMoveEnd)
    if (resolving.value) void resolve()
  }

  function exit(): void {
    clearTimeout(timer)
    controller?.abort()
    seq++
    map?.off('moveend', onMoveEnd)
    map = null
    picking.value = false
    resolving.value = false
    pending.value = null
  }

  function chosen(): Place {
    const { lat, lon } = at.value
    return { name: name.value ?? coordsName(lat, lon), lat, lon }
  }

  function useAsStart(): void {
    if (!canStart.value) return
    if (resolving.value) {
      pending.value = 'start'
      return
    }
    const p = chosen()
    exit()
    setPlace(p)
  }

  function useAsDest(): void {
    if (!canDest.value) return
    if (resolving.value) {
      pending.value = 'dest'
      return
    }
    const p = chosen()
    exit()
    setDest(p)
  }

  onBeforeUnmount(exit)
  return { picking, resolving, pending, name, outside, canStart, canDest, enter, cancel: exit, useAsStart, useAsDest }
}
