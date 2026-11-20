import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { initStore } from './store'
import { initInstall } from './lib/install'
import { initTheme } from './lib/theme'
import { initUpdates } from './lib/update'

initTheme()
initUpdates()
initInstall()
createApp(App).mount('#app')
initStore()
