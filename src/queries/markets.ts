import { useQuery } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { keys } from '@/queries/keys'
import type { Match, Pool, Settings, Team } from '@/lib/types'

// Static-ish reference data: fetched once, cached.
export function useTeams() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.teams(),
    enabled: isAuthed,
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase.from('teams').select('*')
      if (error) throw error
      return data as Team[]
    },
  })
}

export function useMatches() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.matches(),
    enabled: isAuthed,
    queryFn: async (): Promise<Match[]> => {
      const { data, error } = await supabase.from('matches').select('*').order('match_order')
      if (error) throw error
      return data as Match[]
    },
  })
}

// Settings flips (lock, settled_at) drive the whole UI, so poll it.
export function useSettings() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.settings(),
    enabled: isAuthed,
    refetchInterval: 4000,
    queryFn: async (): Promise<Settings> => {
      const { data, error } = await supabase.from('settings').select('*').single()
      if (error) throw error
      return data as Settings
    },
  })
}

// Live parimutuel pools: poll so totals/odds stay fresh as others bet.
export function usePools() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.pools(),
    enabled: isAuthed,
    refetchInterval: 4000,
    queryFn: async (): Promise<Pool[]> => {
      const { data, error } = await supabase.rpc('get_market_pools')
      if (error) throw error
      return ((data as Pool[]) ?? []).map((p) => ({
        ...p,
        total_stake: Number(p.total_stake),
        bet_count: Number(p.bet_count),
      }))
    },
  })
}
