import { createApp } from 'vue'
import 'leaflet/dist/leaflet.css'
import './style.css'
import App from './App.vue'
import { initStore } from './store'

createApp(App).mount('#app')
initStore()
