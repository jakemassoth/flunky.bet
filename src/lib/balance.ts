import type { Bet } from './types'

// Pure balance math (mirrors the DB's derived-balance rule in SPEC 2.2).

export function totalStaked(bets: Bet[]): number {
  return bets.reduce((sum, b) => sum + b.stake, 0)
}

export function totalPayout(bets: Bet[]): number {
  return bets.reduce((sum, b) => sum + b.payout, 0)
}

export function availableBalance(startingCredits: number, bets: Bet[]): number {
  return startingCredits - totalStaked(bets) + totalPayout(bets)
}
