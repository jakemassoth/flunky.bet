<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Team } from '@/lib/types'
import { errorMessage } from '@/lib/errors'
import { impliedOdds, poolStake } from '@/lib/odds'
import { availableBalance } from '@/lib/balance'
import { usePools, useSettings } from '@/queries/markets'
import { useCancelBet, useMyBets, usePlaceBet } from '@/queries/bets'

const props = defineProps<{
  marketKey: string
  marketType: 'match' | 'tournament_winner'
  matchId: string | null
  title: string
  outcomes: Team[]
  winnerTeamId?: string | null
}>()

const { data: pools } = usePools()
const { data: settings } = useSettings()
const { data: myBets } = useMyBets()
const placeBet = usePlaceBet()
const cancelBet = useCancelBet()

const poolList = computed(() => pools.value ?? [])
const bettingOpen = computed(() => settings.value?.betting_open ?? false)
const settled = computed(() => !!settings.value?.settled_at)
const myBet = computed(() => (myBets.value ?? []).find((b) => b.market_key === props.marketKey))
const myBetTeam = computed(() => props.outcomes.find((t) => t.id === myBet.value?.team_id))

const busy = computed(() => placeBet.isPending.value || cancelBet.isPending.value)

const selectedTeamId = ref('')
const stake = ref(10)
const error = ref('')

// Editing your own bet frees its current stake, so it counts toward your max.
const maxStake = computed(
  () =>
    availableBalance(settings.value?.starting_credits ?? 200, myBets.value ?? []) +
    (myBet.value?.stake ?? 0),
)

// Pre-fill the form from an existing bet (and whenever it changes).
watch(
  myBet,
  (bet) => {
    if (bet) {
      selectedTeamId.value = bet.team_id
      stake.value = bet.stake
    }
  },
  { immediate: true },
)

function odds(teamId: string): string {
  const o = impliedOdds(poolList.value, props.marketKey, teamId)
  return o === null ? '—' : `~${o.toFixed(1)}x`
}

async function place() {
  error.value = ''
  if (!selectedTeamId.value) {
    error.value = 'Pick a side first.'
    return
  }
  const s = Math.floor(Number(stake.value))
  if (!Number.isFinite(s) || s < 1) {
    error.value = 'Stake must be a whole number ≥ 1.'
    return
  }
  try {
    await placeBet.mutateAsync({
      existingBetId: myBet.value?.id,
      marketType: props.marketType,
      matchId: props.matchId,
      teamId: selectedTeamId.value,
      stake: s,
    })
  } catch (e: unknown) {
    error.value = errorMessage(e)
  }
}

async function cancel() {
  error.value = ''
  if (!myBet.value) return
  try {
    await cancelBet.mutateAsync(myBet.value)
    selectedTeamId.value = ''
    stake.value = 10
  } catch (e: unknown) {
    error.value = errorMessage(e)
  }
}
</script>

<template>
  <div class="card" :class="{ settled }">
    <div class="card-head">
      <h3>{{ title }}</h3>
      <span v-if="myBet" class="mine">
        your bet: {{ myBetTeam?.name }} · {{ myBet.stake }}
        <template v-if="myBet.settled"> → won {{ myBet.payout }}</template>
      </span>
    </div>

    <table class="outcomes">
      <tbody>
        <tr
          v-for="t in outcomes"
          :key="t.id"
          :class="{ winner: settled && winnerTeamId === t.id }"
        >
          <td class="pick">
            <label>
              <input
                type="radio"
                :name="`m-${marketKey}`"
                :value="t.id"
                v-model="selectedTeamId"
                :disabled="!bettingOpen"
              />
              {{ t.name }}
              <span v-if="settled && winnerTeamId === t.id" class="tag">WON</span>
            </label>
          </td>
          <td class="num">{{ poolStake(poolList, marketKey, t.id) }} staked</td>
          <td class="num odds">{{ odds(t.id) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="bettingOpen" class="form">
      <label>
        Stake
        <input type="number" min="1" :max="maxStake" step="1" v-model.number="stake" />
      </label>
      <button :disabled="busy" @click="place">{{ myBet ? 'Update' : 'Place bet' }}</button>
      <button v-if="myBet" class="ghost" :disabled="busy" @click="cancel">Cancel</button>
    </div>
    <div v-else class="locked-note">Betting locked</div>

    <p v-if="error" class="err">{{ error }}</p>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  background: var(--panel);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  flex-wrap: wrap;
}
h3 {
  margin: 0;
  font-size: 1rem;
}
.mine {
  font-size: 0.8rem;
  color: var(--accent);
}
.outcomes {
  width: 100%;
  margin: 0.5rem 0;
  border-collapse: collapse;
}
.outcomes td {
  padding: 0.2rem 0;
  font-size: 0.9rem;
}
.num {
  text-align: right;
  color: var(--muted);
  white-space: nowrap;
}
.odds {
  width: 4.5rem;
}
tr.winner {
  color: var(--accent);
  font-weight: 600;
}
.tag {
  font-size: 0.65rem;
  background: var(--accent);
  color: #04120a;
  border-radius: 4px;
  padding: 0 0.3rem;
  margin-left: 0.3rem;
}
.form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.form input {
  width: 5rem;
}
.locked-note {
  font-size: 0.8rem;
  color: var(--muted);
}
button.ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid var(--line);
}
.err {
  color: #ff6b6b;
  font-size: 0.8rem;
  margin: 0.3rem 0 0;
}
</style>
