import './assets/main.css'

import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'

import App from './App.vue'
import router from './router'
import { initAuth } from './composables/useAuth'

const app = createApp(App)

app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
    },
  },
})

// Resolve the session before mounting so the router guard sees it.
await initAuth()

app.use(router)
app.mount('#app')
