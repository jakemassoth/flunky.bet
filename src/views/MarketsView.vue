<script setup lang="ts">
import { computed } from 'vue'
import { type Team, TOURNAMENT_KEY } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { useMatches, usePools, useSettings, useTeams } from '@/queries/markets'
import MarketCard from '@/components/MarketCard.vue'

const { data: teams, isPending: teamsLoading, isError: teamsError, error: teamsErr } = useTeams()
const { data: matches, isPending: matchesLoading } = useMatches()
const { data: settings } = useSettings()
// Also observed here purely to surface the background-refetch indicator.
const { isFetching: poolsFetching } = usePools()

const loading = computed(() => teamsLoading.value || matchesLoading.value)
const teamById = computed<Record<string, Team>>(() =>
  Object.fromEntries((teams.value ?? []).map((t) => [t.id, t])),
)
const bettingOpen = computed(() => settings.value?.betting_open ?? false)
const settled = computed(() => !!settings.value?.settled_at)

const matchOutcomes = (teamAId: string, teamBId: string) =>
  [teamById.value[teamAId], teamById.value[teamBId]].filter((t): t is Team => !!t)
</script>

<template>
  <section>
    <div v-if="loading" class="py-4 text-muted">Loading markets…</div>
    <div v-else-if="teamsError" class="py-4 text-danger">
      Couldn't load markets: {{ errorMessage(teamsErr) }}
    </div>

    <template v-else>
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
          :class="bettingOpen ? 'bg-accent/15 text-accent' : 'bg-danger/15 text-danger'"
        >
          {{ bettingOpen ? 'Betting OPEN' : 'Betting LOCKED' }}
        </span>
        <span v-if="settled" class="rounded-full bg-sky-400/15 px-2.5 py-0.5 text-xs font-semibold text-sky-400">
          Settled
        </span>
        <span v-if="poolsFetching" class="text-xs text-muted">⟳ updating pools…</span>
      </div>

      <h2 class="mt-5 mb-2 text-lg font-semibold">Tournament winner</h2>
      <MarketCard
        :market-key="TOURNAMENT_KEY"
        market-type="tournament_winner"
        :match-id="null"
        title="Who wins the most matches?"
        :outcomes="teams ?? []"
      />

      <h2 class="mt-6 mb-2 text-lg font-semibold">Matches</h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <MarketCard
          v-for="m in matches ?? []"
          :key="m.id"
          :market-key="m.id"
          market-type="match"
          :match-id="m.id"
          :title="`${teamById[m.team_a_id]?.name} vs ${teamById[m.team_b_id]?.name}`"
          :outcomes="matchOutcomes(m.team_a_id, m.team_b_id)"
          :winner-team-id="m.winner_team_id"
        />
      </div>
    </template>
  </section>
</template>
