<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useBetsStore } from '@/stores/bets'
import { useMarketsStore } from '@/stores/markets'

const auth = useAuthStore()
const bets = useBetsStore()
const markets = useMarketsStore()
const router = useRouter()

// Keep the header balance correct on any landing page (not just Markets).
async function loadMine() {
  if (!auth.isAuthed) return
  await Promise.all([markets.refreshSettings(), bets.load()])
}
onMounted(loadMine)
watch(() => auth.isAuthed, loadMine)

async function signOut() {
  await auth.signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="auth.isAuthed">
    <div class="brand">flunky<span>.bet</span></div>
    <nav>
      <RouterLink to="/">Markets</RouterLink>
      <RouterLink to="/leaderboard">Leaderboard</RouterLink>
    </nav>
    <div class="right">
      <span class="bal">{{ bets.availableBalance }} cr</span>
      <span class="who">{{ auth.displayName }}</span>
      <button class="ghost" @click="signOut">Sign out</button>
    </div>
  </header>
  <main>
    <RouterView />
  </main>
</template>

<style scoped>
header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.brand {
  font-weight: 700;
}
.brand span {
  color: var(--accent);
}
nav {
  display: flex;
  gap: 1rem;
}
nav a.router-link-exact-active {
  color: var(--accent);
}
.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.bal {
  font-weight: 700;
  color: var(--accent);
}
.who {
  color: var(--muted);
  font-size: 0.9rem;
}
main {
  padding: 1.25rem;
  max-width: 1100px;
  margin: 0 auto;
}
button.ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--line);
}
</style>
