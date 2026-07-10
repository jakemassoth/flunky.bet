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
  <header
    v-if="isAuthed"
    class="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:px-6"
  >
    <div class="text-lg font-bold">flunky<span class="text-accent">.bet</span></div>
    <nav class="flex gap-4">
      <RouterLink
        to="/"
        class="hover:text-accent [&.router-link-exact-active]:text-accent"
        >Markets</RouterLink
      >
      <RouterLink
        to="/leaderboard"
        class="hover:text-accent [&.router-link-exact-active]:text-accent"
        >Leaderboard</RouterLink
      >
    </nav>
    <div class="ml-auto flex items-center gap-3">
      <span class="font-bold text-accent">{{ balance }} cr</span>
      <span class="hidden text-sm text-muted sm:inline">{{ displayName }}</span>
      <button class="btn btn-ghost" @click="onSignOut">Sign out</button>
    </div>
  </header>
  <main class="mx-auto max-w-[1100px] px-4 py-5 sm:px-6">
    <RouterView />
  </main>
</template>
