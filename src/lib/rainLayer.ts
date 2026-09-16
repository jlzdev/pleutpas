import * as L from 'leaflet'

export interface RainLayer extends L.ImageOverlay {
  draw(from: HTMLImageElement, to: HTMLImageElement | null, mix: number): void
  clear(): void
}

interface Internals {
  _image?: HTMLCanvasElement
  _zoomAnimated: boolean
  _updateZIndex(): void
}

// ImageOverlay dont l'element est un canvas : l'image est dessinee de facon synchrone a
// partir de frames deja decodees, sans jamais laisser passer une image vide, et deux frames
// consecutives peuvent se fondre l'une dans l'autre (mix de 0 a 1) sans creux d'opacite
// la ou les deux sont colorees
const RainLayerClass = L.ImageOverlay.extend({
  _initImage(this: Internals) {
    const cv = L.DomUtil.create('canvas', 'leaflet-image-layer' + (this._zoomAnimated ? ' leaflet-zoom-animated' : '')) as HTMLCanvasElement
    cv.onselectstart = () => false
    cv.onmousemove = () => false
    this._image = cv
    this._updateZIndex()
  },

  draw(this: Internals, from: HTMLImageElement, to: HTMLImageElement | null, mix: number) {
    const cv = this._image
    if (!cv) return
    const w = Math.max(from.naturalWidth, to?.naturalWidth ?? 0)
    const h = Math.max(from.naturalHeight, to?.naturalHeight ?? 0)
    if (cv.width !== w || cv.height !== h) {
      cv.width = w
      cv.height = h
    }
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    if (!to || mix <= 0) {
      ctx.globalAlpha = 1
      ctx.drawImage(from, 0, 0, w, h)
      return
    }
    if (mix >= 1) {
      ctx.globalAlpha = 1
      ctx.drawImage(to, 0, 0, w, h)
      return
    }
    if (mix < 0.5) {
      ctx.globalAlpha = 1
      ctx.drawImage(from, 0, 0, w, h)
      ctx.globalAlpha = mix * 2
      ctx.drawImage(to, 0, 0, w, h)
    } else {
      ctx.globalAlpha = (1 - mix) * 2
      ctx.drawImage(from, 0, 0, w, h)
      ctx.globalAlpha = 1
      ctx.drawImage(to, 0, 0, w, h)
    }
  },

  clear(this: Internals) {
    if (!this._image) return
    this._image.width = 0
    this._image.height = 0
  },
})

const RainLayerCtor = RainLayerClass as unknown as new (
  url: null,
  bounds: L.LatLngBoundsExpression,
  options: L.ImageOverlayOptions,
) => RainLayer

export function rainLayer(bounds: L.LatLngBoundsExpression, options: L.ImageOverlayOptions): RainLayer {
  return new RainLayerCtor(null, bounds, options)
}
