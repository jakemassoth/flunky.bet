<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { useSettings } from '@/queries/markets'
import { useMyBets } from '@/queries/bets'
import { availableBalance } from '@/lib/balance'

const { isAuthed, displayName, signOut } = useAuth()
const router = useRouter()

const { data: settings } = useSettings()
const { data: myBets } = useMyBets()

const balance = computed(() =>
  availableBalance(settings.value?.starting_credits ?? 200, myBets.value ?? []),
)

async function onSignOut() {
  await signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header v-if="isAuthed">
    <div class="brand">flunky<span>.bet</span></div>
    <nav>
      <RouterLink to="/">Markets</RouterLink>
      <RouterLink to="/leaderboard">Leaderboard</RouterLink>
    </nav>
    <div class="right">
      <span class="bal">{{ balance }} cr</span>
      <span class="who">{{ displayName }}</span>
      <button class="ghost" @click="onSignOut">Sign out</button>
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
