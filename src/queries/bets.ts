import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/composables/useAuth'
import { keys } from '@/queries/keys'
import { applyOptimisticStake, removeOptimisticStake } from '@/lib/odds'
import { type Bet, type Pool, TOURNAMENT_KEY } from '@/lib/types'

export function useMyBets() {
  const { isAuthed } = useAuth()
  return useQuery({
    queryKey: keys.bets.mine(),
    enabled: isAuthed,
    refetchInterval: 4000, // so settlement payouts appear without a manual reload
    queryFn: async (): Promise<Bet[]> => {
      const { data, error } = await supabase.from('bets').select('*')
      if (error) throw error
      return data as Bet[]
    },
  })
}

export type PlaceBetVars = {
  existingBetId?: string
  marketType: 'match' | 'tournament_winner'
  matchId: string | null
  teamId: string
  stake: number
}

// Place or edit the single bet for a market. Optimistically updates the user's
// bets and the affected pool, rolls back on error (e.g. the balance trigger),
// then invalidates to reconcile with the server.
export function usePlaceBet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: PlaceBetVars) => {
      if (v.existingBetId) {
        const { error } = await supabase
          .from('bets')
          .update({ team_id: v.teamId, stake: v.stake })
          .eq('id', v.existingBetId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('bets').insert({
          market_type: v.marketType,
          match_id: v.matchId,
          team_id: v.teamId,
          stake: v.stake,
        })
        if (error) throw error
      }
    },
    onMutate: async (v) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: keys.bets.mine() }),
        qc.cancelQueries({ queryKey: keys.pools() }),
      ])
      const prevBets = qc.getQueryData<Bet[]>(keys.bets.mine())
      const prevPools = qc.getQueryData<Pool[]>(keys.pools())
      const marketKey = v.matchId ?? TOURNAMENT_KEY
      const existing = prevBets?.find((b) => b.id === v.existingBetId)

      qc.setQueryData<Bet[]>(keys.bets.mine(), (old = []) => {
        if (existing) {
          return old.map((b) =>
            b.id === existing.id ? { ...b, team_id: v.teamId, stake: v.stake } : b,
          )
        }
        const optimistic: Bet = {
          id: `optimistic-${marketKey}`,
          user_id: '',
          market_type: v.marketType,
          match_id: v.matchId,
          team_id: v.teamId,
          stake: v.stake,
          payout: 0,
          settled: false,
          market_key: marketKey,
        }
        return [...old, optimistic]
      })

      qc.setQueryData<Pool[]>(keys.pools(), (old = []) =>
        applyOptimisticStake(old, {
          market_key: marketKey,
          market_type: v.marketType,
          match_id: v.matchId,
          oldTeamId: existing?.team_id,
          oldStake: existing?.stake,
          newTeamId: v.teamId,
          newStake: v.stake,
        }),
      )
      return { prevBets, prevPools }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevBets) qc.setQueryData(keys.bets.mine(), ctx.prevBets)
      if (ctx?.prevPools) qc.setQueryData(keys.pools(), ctx.prevPools)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.bets.mine() })
      qc.invalidateQueries({ queryKey: keys.pools() })
    },
  })
}

// Cancel a bet. Takes the full bet so the pool delta can be applied optimistically.
export function useCancelBet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bet: Bet) => {
      const { error } = await supabase.from('bets').delete().eq('id', bet.id)
      if (error) throw error
    },
    onMutate: async (bet) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: keys.bets.mine() }),
        qc.cancelQueries({ queryKey: keys.pools() }),
      ])
      const prevBets = qc.getQueryData<Bet[]>(keys.bets.mine())
      const prevPools = qc.getQueryData<Pool[]>(keys.pools())
      qc.setQueryData<Bet[]>(keys.bets.mine(), (old = []) => old.filter((b) => b.id !== bet.id))
      qc.setQueryData<Pool[]>(keys.pools(), (old = []) =>
        removeOptimisticStake(old, bet.market_key, bet.team_id, bet.stake),
      )
      return { prevBets, prevPools }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevBets) qc.setQueryData(keys.bets.mine(), ctx.prevBets)
      if (ctx?.prevPools) qc.setQueryData(keys.pools(), ctx.prevPools)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.bets.mine() })
      qc.invalidateQueries({ queryKey: keys.pools() })
    },
  })
}
