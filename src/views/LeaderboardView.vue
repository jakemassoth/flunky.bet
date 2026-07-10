<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { LeaderboardRow } from '@/lib/types'

const rows = ref<LeaderboardRow[]>([])
const loaded = ref(false)

onMounted(async () => {
  const { data } = await supabase.rpc('get_leaderboard')
  rows.value = (data as LeaderboardRow[]) ?? []
  loaded.value = true
})
</script>

<template>
  <section>
    <h2>Leaderboard</h2>
    <p v-if="loaded && rows.length === 0" class="muted">
      Results not in yet — the leaderboard unlocks the moment the tournament settles.
    </p>
    <table v-else-if="rows.length" class="board">
      <thead>
        <tr><th>#</th><th>Player</th><th class="num">Credits</th></tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="`${r.rank}-${r.display_name}`">
          <td>{{ r.rank }}</td>
          <td>{{ r.display_name }}</td>
          <td class="num">{{ r.credits }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>

<style scoped>
h2 {
  font-size: 1.1rem;
}
.muted {
  color: var(--muted);
}
.board {
  width: 100%;
  border-collapse: collapse;
  max-width: 480px;
}
.board th,
.board td {
  text-align: left;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--line);
}
.num {
  text-align: right;
}
</style>
