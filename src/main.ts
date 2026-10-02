import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import 'leaflet/dist/leaflet.css'
import './style.css'
import App from './App.vue'
import { initStore } from './store'
import { initInstall } from './lib/install'

registerSW({ immediate: true })
initInstall()
createApp(App).mount('#app')
initStore()
