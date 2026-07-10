import type { Pool } from './types'

// Pure parimutuel helpers over a flat list of pool rows (from get_market_pools).
// No framework/state — the functional core; the query layer is the shell.

export function poolStake(pools: Pool[], marketKey: string, teamId: string): number {
  const row = pools.find((p) => p.market_key === marketKey && p.team_id === teamId)
  return row ? row.total_stake : 0
}

export function poolTotal(pools: Pool[], marketKey: string): number {
  return pools
    .filter((p) => p.market_key === marketKey)
    .reduce((sum, p) => sum + p.total_stake, 0)
}

// Implied payout multiplier for one outcome: whole pool / stake on that outcome.
// Null when nobody has backed the outcome yet (caller shows "—").
export function impliedOdds(pools: Pool[], marketKey: string, teamId: string): number | null {
  const stake = poolStake(pools, marketKey, teamId)
  if (stake === 0) return null
  return poolTotal(pools, marketKey) / stake
}

// --- Optimistic pool updates (pure) --------------------------------------
// Used to reflect a bet locally before the server round-trips, then rolled
// back on error. Kept pure so it's trivially testable.

type StakeChange = {
  market_key: string
  market_type: 'match' | 'tournament_winner'
  match_id: string | null
  oldTeamId?: string
  oldStake?: number
  newTeamId: string
  newStake: number
}

export function applyOptimisticStake(pools: Pool[], c: StakeChange): Pool[] {
  const next = pools.map((p) => ({ ...p }))
  const bump = (teamId: string, stakeDelta: number, countDelta: number) => {
    const row = next.find((p) => p.market_key === c.market_key && p.team_id === teamId)
    if (row) {
      row.total_stake += stakeDelta
      row.bet_count += countDelta
    } else if (stakeDelta > 0) {
      next.push({
        market_key: c.market_key,
        market_type: c.market_type,
        match_id: c.match_id,
        team_id: teamId,
        total_stake: stakeDelta,
        bet_count: Math.max(countDelta, 1),
      })
    }
  }
  const editing = c.oldTeamId != null && c.oldStake != null
  if (editing && c.oldTeamId === c.newTeamId) {
    bump(c.newTeamId, c.newStake - (c.oldStake as number), 0) // same outcome, restake
  } else {
    if (editing) bump(c.oldTeamId as string, -(c.oldStake as number), -1)
    bump(c.newTeamId, c.newStake, 1)
  }
  return next.filter((p) => p.total_stake > 0)
}

export function removeOptimisticStake(
  pools: Pool[],
  marketKey: string,
  teamId: string,
  stake: number,
): Pool[] {
  return pools
    .map((p) =>
      p.market_key === marketKey && p.team_id === teamId
        ? { ...p, total_stake: p.total_stake - stake, bet_count: p.bet_count - 1 }
        : p,
    )
    .filter((p) => p.total_stake > 0)
}
