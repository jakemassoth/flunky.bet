import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import MarketsView from '@/views/MarketsView.vue'
import LeaderboardView from '@/views/LeaderboardView.vue'
import LoginView from '@/views/LoginView.vue'
import SignupView from '@/views/SignupView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'markets', component: MarketsView },
    { path: '/leaderboard', name: 'leaderboard', component: LeaderboardView },
    { path: '/login', name: 'login', component: LoginView },
    { path: '/signup', name: 'signup', component: SignupView },
  ],
})

const PUBLIC = new Set(['login', 'signup'])

router.beforeEach((to) => {
  const { isAuthed } = useAuth()
  const isPublic = PUBLIC.has(to.name as string)
  if (!isAuthed.value && !isPublic) return { name: 'login' }
  if (isAuthed.value && isPublic) return { name: 'markets' }
  return true
})

export default router
