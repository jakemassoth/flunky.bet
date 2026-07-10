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
  <div class="rounded-lg border border-line bg-panel p-4" :class="{ 'opacity-80': settled }">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h3 class="text-base font-semibold">{{ title }}</h3>
      <span v-if="myBet" class="text-xs text-accent">
        your bet: {{ myBetTeam?.name }} · {{ myBet.stake }}
        <template v-if="myBet.settled"> → won {{ myBet.payout }}</template>
      </span>
    </div>

    <table class="my-2 w-full border-collapse">
      <tbody>
        <tr
          v-for="t in outcomes"
          :key="t.id"
          :class="{ 'font-semibold text-accent': settled && winnerTeamId === t.id }"
        >
          <td class="py-1.5 pr-3">
            <label class="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                class="size-4 shrink-0 accent-accent"
                :name="`m-${marketKey}`"
                :value="t.id"
                v-model="selectedTeamId"
                :disabled="!bettingOpen"
              />
              <span>{{ t.name }}</span>
              <span
                v-if="settled && winnerTeamId === t.id"
                class="rounded bg-accent px-1.5 text-[0.65rem] font-semibold text-accent-ink"
                >WON</span
              >
            </label>
          </td>
          <td class="whitespace-nowrap py-1.5 text-right text-sm text-muted">
            {{ poolStake(poolList, marketKey, t.id) }} staked
          </td>
          <td class="w-16 whitespace-nowrap py-1.5 text-right text-sm text-muted">{{ odds(t.id) }}</td>
        </tr>
      </tbody>
    </table>

    <div v-if="bettingOpen" class="flex flex-wrap items-center gap-2">
      <label class="flex items-center gap-2 text-sm">
        Stake
        <input
          type="number"
          min="1"
          :max="maxStake"
          step="1"
          v-model.number="stake"
          class="field w-20"
        />
      </label>
      <button class="btn" :disabled="busy" @click="place">
        {{ myBet ? 'Update' : 'Place bet' }}
      </button>
      <button v-if="myBet" class="btn btn-ghost" :disabled="busy" @click="cancel">Cancel</button>
    </div>
    <div v-else class="text-sm text-muted">Betting locked</div>

    <p v-if="error" class="mt-1.5 text-sm text-danger">{{ error }}</p>
  </div>
</template>
