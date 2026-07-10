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
    <div v-if="loading" class="note">Loading markets…</div>
    <div v-else-if="teamsError" class="note err">Couldn't load markets: {{ errorMessage(teamsErr) }}</div>

    <template v-else>
      <div class="status">
        <span class="pill" :class="bettingOpen ? 'open' : 'locked'">
          {{ bettingOpen ? 'Betting OPEN' : 'Betting LOCKED' }}
        </span>
        <span v-if="settled" class="pill settled">Settled</span>
        <span v-if="poolsFetching" class="live">⟳ updating pools…</span>
      </div>

      <h2>Tournament winner</h2>
      <MarketCard
        :market-key="TOURNAMENT_KEY"
        market-type="tournament_winner"
        :match-id="null"
        title="Who wins the most matches?"
        :outcomes="teams ?? []"
      />

      <h2>Matches</h2>
      <div class="grid">
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

<style scoped>
.note {
  color: var(--muted);
  padding: 1rem 0;
}
.note.err {
  color: #ff8a8a;
}
.status {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
}
.pill {
  font-size: 0.8rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
}
.pill.open {
  background: #12351f;
  color: var(--accent);
}
.pill.locked {
  background: #3a1414;
  color: #ff8a8a;
}
.pill.settled {
  background: #142a3a;
  color: #8ac6ff;
}
.live {
  font-size: 0.75rem;
  color: var(--muted);
}
h2 {
  font-size: 1.1rem;
  margin: 1.25rem 0 0.5rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 0.75rem;
}
</style>
