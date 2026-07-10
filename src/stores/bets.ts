import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import { type Bet, TOURNAMENT_KEY } from '@/lib/types'
import { useMarketsStore } from '@/stores/markets'

export const useBetsStore = defineStore('bets', () => {
  const markets = useMarketsStore()
  const myBets = ref<Bet[]>([])

  const totalStaked = computed(() => myBets.value.reduce((s, b) => s + b.stake, 0))
  const totalPayout = computed(() => myBets.value.reduce((s, b) => s + b.payout, 0))
  const availableBalance = computed(
    () => markets.startingCredits - totalStaked.value + totalPayout.value,
  )

  function betForMarket(marketKey: string): Bet | undefined {
    return myBets.value.find((b) => b.market_key === marketKey)
  }

  async function load() {
    const { data } = await supabase.from('bets').select('*')
    myBets.value = (data as Bet[]) ?? []
  }

  // Place or update the single bet for a market (one bet per market per user).
  async function submit(opts: {
    marketType: 'match' | 'tournament_winner'
    matchId: string | null
    teamId: string
    stake: number
  }) {
    const marketKey = opts.matchId ?? TOURNAMENT_KEY
    const existing = betForMarket(marketKey)
    if (existing) {
      const { error } = await supabase
        .from('bets')
        .update({ team_id: opts.teamId, stake: opts.stake })
        .eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('bets').insert({
        market_type: opts.marketType,
        match_id: opts.matchId,
        team_id: opts.teamId,
        stake: opts.stake,
      })
      if (error) throw error
    }
    await load()
  }

  async function cancel(marketKey: string) {
    const existing = betForMarket(marketKey)
    if (!existing) return
    const { error } = await supabase.from('bets').delete().eq('id', existing.id)
    if (error) throw error
    await load()
  }

  return {
    myBets,
    totalStaked,
    totalPayout,
    availableBalance,
    betForMarket,
    load,
    submit,
    cancel,
  }
})
