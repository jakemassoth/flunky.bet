// Query-key factory modelling the product domain. Every query/mutation and
// every invalidation references these so keys never drift.
export const keys = {
  teams: () => ['teams'] as const,
  matches: () => ['matches'] as const,
  settings: () => ['settings'] as const,
  pools: () => ['pools'] as const,
  bets: {
    all: () => ['bets'] as const,
    mine: () => ['bets', 'mine'] as const,
  },
  leaderboard: () => ['leaderboard'] as const,
}
