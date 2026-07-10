export type Team = { id: string; slug: string; name: string }

export type Match = {
  id: string
  slug: string
  team_a_id: string
  team_b_id: string
  match_order: number
  winner_team_id: string | null
}

export type Settings = {
  id: number
  betting_open: boolean
  starting_credits: number
  settled_at: string | null
}

export type Bet = {
  id: string
  user_id: string
  market_type: 'match' | 'tournament_winner'
  match_id: string | null
  team_id: string
  stake: number
  payout: number
  settled: boolean
  market_key: string
}

export type Pool = {
  market_key: string
  market_type: string
  match_id: string | null
  team_id: string
  total_stake: number
  bet_count: number
}

export type LeaderboardRow = { display_name: string; credits: number; rank: number }

export const TOURNAMENT_KEY = 'TOURNAMENT_WINNER'
