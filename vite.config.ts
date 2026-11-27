import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { version } from './package.json'

function preloadChunks(names: string[]): Plugin {
  let files: string[] = []
  return {
    name: 'preload-chunks',
    apply: 'build',
    enforce: 'pre',
    generateBundle(_, bundle) {
      files = Object.values(bundle)
        .filter((c) => c.type === 'chunk' && names.includes(c.name))
        .map((c) => c.fileName)
    },
    transformIndexHtml: {
      order: 'post',
      handler: () => files.map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', href: '/' + f, crossorigin: true }, injectTo: 'head' as const })),
    },
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    preloadChunks(['RadarCard']),
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png'],
      manifest: {
        name: 'Pleut pas ?',
        short_name: 'Pleut pas',
        description: 'Est-ce que je peux prendre mon velo, et sinon a quelle heure ?',
        lang: 'fr',
        start_url: '.',
        shortcuts: [
          { name: 'Favori 1', short_name: 'Favori 1', description: 'Premier favori', url: '/?fav=1' },
          { name: 'Favori 2', short_name: 'Favori 2', description: 'Deuxième favori', url: '/?fav=2' },
        ],
        display: 'standalone',
        background_color: '#0e1420',
        theme_color: '#0e1420',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
