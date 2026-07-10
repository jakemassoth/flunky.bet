import { useQuery } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { keys } from '@/queries/keys'
import type { LeaderboardRow } from '@/lib/types'

// Gated server-side: returns [] until the tournament is settled.
export function useLeaderboard() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.leaderboard(),
    enabled: isAuthed,
    queryFn: async (): Promise<LeaderboardRow[]> => {
      const { data, error } = await supabase.rpc('get_leaderboard')
      if (error) throw error
      return (data as LeaderboardRow[]) ?? []
    },
  })
}
