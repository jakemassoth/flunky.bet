import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Match, Pool, Settings, Team } from '@/lib/types'

export const useMarketsStore = defineStore('markets', () => {
  const teams = ref<Team[]>([])
  const matches = ref<Match[]>([])
  const settings = ref<Settings | null>(null)
  const pools = ref<Pool[]>([])

  const teamById = computed<Record<string, Team>>(() =>
    Object.fromEntries(teams.value.map((t) => [t.id, t])),
  )
  const bettingOpen = computed(() => settings.value?.betting_open ?? false)
  const startingCredits = computed(() => settings.value?.starting_credits ?? 200)
  const settled = computed(() => !!settings.value?.settled_at)

  async function loadStatic() {
    const [t, m, s] = await Promise.all([
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*').order('match_order'),
      supabase.from('settings').select('*').single(),
    ])
    teams.value = (t.data as Team[]) ?? []
    matches.value = (m.data as Match[]) ?? []
    settings.value = (s.data as Settings) ?? null
  }

  async function refreshSettings() {
    const { data } = await supabase.from('settings').select('*').single()
    if (data) settings.value = data as Settings
  }

  async function refreshPools() {
    const { data } = await supabase.rpc('get_market_pools')
    pools.value = ((data as Pool[]) ?? []).map((p) => ({
      ...p,
      total_stake: Number(p.total_stake),
      bet_count: Number(p.bet_count),
    }))
  }

  function poolStake(marketKey: string, teamId: string): number {
    const row = pools.value.find((p) => p.market_key === marketKey && p.team_id === teamId)
    return row ? row.total_stake : 0
  }

  function poolTotal(marketKey: string): number {
    return pools.value
      .filter((p) => p.market_key === marketKey)
      .reduce((sum, p) => sum + p.total_stake, 0)
  }

  // Implied payout multiplier for one outcome: whole pool / stake on that outcome.
  // Null when nobody has backed the outcome yet (show "—").
  function impliedOdds(marketKey: string, teamId: string): number | null {
    const stake = poolStake(marketKey, teamId)
    if (stake === 0) return null
    return poolTotal(marketKey) / stake
  }

  return {
    teams,
    matches,
    settings,
    pools,
    teamById,
    bettingOpen,
    startingCredits,
    settled,
    loadStatic,
    refreshSettings,
    refreshPools,
    poolStake,
    poolTotal,
    impliedOdds,
  }
})
