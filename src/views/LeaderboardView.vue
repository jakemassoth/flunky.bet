<script setup lang="ts">
import { errorMessage } from '@/lib/errors'
import { useLeaderboard } from '@/queries/leaderboard'

const { data: rows, isPending, isError, error } = useLeaderboard()
</script>

<template>
  <section>
    <h2 class="mb-3 text-lg font-semibold">Leaderboard</h2>
    <p v-if="isPending" class="text-muted">Loading…</p>
    <p v-else-if="isError" class="text-danger">Couldn't load leaderboard: {{ errorMessage(error) }}</p>
    <p v-else-if="(rows?.length ?? 0) === 0" class="text-muted">
      Results not in yet — the leaderboard unlocks the moment the tournament settles.
    </p>
    <table v-else class="w-full max-w-lg border-collapse">
      <thead>
        <tr class="border-b border-line">
          <th class="px-2.5 py-2 text-left font-semibold">#</th>
          <th class="px-2.5 py-2 text-left font-semibold">Player</th>
          <th class="px-2.5 py-2 text-right font-semibold">Credits</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="`${r.rank}-${r.display_name}`" class="border-b border-line">
          <td class="px-2.5 py-2 text-muted">{{ r.rank }}</td>
          <td class="px-2.5 py-2">{{ r.display_name }}</td>
          <td class="px-2.5 py-2 text-right tabular-nums">{{ r.credits }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
