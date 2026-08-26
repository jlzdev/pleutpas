import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import 'leaflet/dist/leaflet.css'
import './style.css'
import App from './App.vue'
import { initStore } from './store'

registerSW({ immediate: true })
createApp(App).mount('#app')
initStore()
