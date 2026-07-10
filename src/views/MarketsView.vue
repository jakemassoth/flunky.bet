<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { type Team, TOURNAMENT_KEY } from '@/lib/types'
import { useMarketsStore } from '@/stores/markets'
import { useBetsStore } from '@/stores/bets'
import MarketCard from '@/components/MarketCard.vue'

const markets = useMarketsStore()
const bets = useBetsStore()

let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  await markets.loadStatic()
  await Promise.all([markets.refreshPools(), bets.load()])
  // Poll pools + settings so pools stay live and lock/settle flips propagate.
  timer = setInterval(() => {
    void markets.refreshPools()
    void markets.refreshSettings()
    void bets.load()
  }, 4000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const matchOutcomes = (teamAId: string, teamBId: string) =>
  [markets.teamById[teamAId], markets.teamById[teamBId]].filter(
    (t): t is Team => !!t,
  )
</script>

<template>
  <section>
    <div class="status">
      <span
        class="pill"
        :class="markets.bettingOpen ? 'open' : 'locked'"
      >{{ markets.bettingOpen ? 'Betting OPEN' : 'Betting LOCKED' }}</span>
      <span v-if="markets.settled" class="pill settled">Settled</span>
    </div>

    <h2>Tournament winner</h2>
    <MarketCard
      :market-key="TOURNAMENT_KEY"
      market-type="tournament_winner"
      :match-id="null"
      title="Who wins the most matches?"
      :outcomes="markets.teams"
    />

    <h2>Matches</h2>
    <div class="grid">
      <MarketCard
        v-for="m in markets.matches"
        :key="m.id"
        :market-key="m.id"
        market-type="match"
        :match-id="m.id"
        :title="`${markets.teamById[m.team_a_id]?.name} vs ${markets.teamById[m.team_b_id]?.name}`"
        :outcomes="matchOutcomes(m.team_a_id, m.team_b_id)"
        :winner-team-id="m.winner_team_id"
      />
    </div>
  </section>
</template>

<style scoped>
.status {
  display: flex;
  gap: 0.5rem;
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
