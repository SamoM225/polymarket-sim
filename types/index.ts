export interface MatchPrices {
  home: { yes: number; no: number; };
  away: { yes: number; no: number; };
  draw?: { yes: number; no: number; };
}

export interface Team {
  id: string;
  name: string;
  logo?: string;
  shortName?: string;
}

export interface League {
  id: string;
  name: string;
  country?: string;
  hasDraw: boolean;
}

export interface Match {
  id: string;
  title?: string;
  sport?: string | null;
  aiResponse?: string | null;
  league: League;
  homeTeam: Team;
  awayTeam: Team;
  startTime: string;
  status: 'SCHEDULED' | 'LIVE' | 'RESOLVED';
  currentScore?: {
    home: number;
    away: number;
  };
  simulationMinute?: number;
  liveTime?: string;
  stats?: {
    possession?: number;
    shotsOnTarget?: [number, number];
  };
  prices: MatchPrices;
  marketType?: '1X2' | 'BINARY' | 'MULTI_OUTCOME' | 'MULTIOUTCOME' | string;
  matchState?: MatchState;
  outcomes?: Array<{
    id: string;
    slug: string;
    label: string;
    price: number;
    position?: number;
  }>;
}

export type Outcome = {
  id: string;
  outcome_slug: string;
  label: string;
  pool: number;
  current_fee_rate?: number | null;
};

export type Market = {
  id: string;
  type: '1X2' | 'BINARY' | 'MULTI_OUTCOME' | 'MULTIOUTCOME' | string;
  liquidity_usdc: number;
  risk_multiplier?: number | null;
  status: 'OPEN' | 'LOCKED' | 'RESOLVED';
  outcomes: Outcome[];
};

export type MultiOutcomeMatchState = {
  positions?: string[];
  last_event?: string;
};

export type RegularMatchState = {
  last_event?: string;
  score_history?: Array<{
    h: number;
    a: number;
    min: number;
  }>;
};

export type MatchState = MultiOutcomeMatchState | RegularMatchState | null;

export type SupabaseMatch = {
  id: string;
  title: string;
  start_time: string;
  status: 'OPEN' | 'LOCKED' | 'RESOLVED';
  home_team: string;
  away_team: string;
  sport?: string | null;
  ai_response?: string | null;
  home_goals?: number;
  away_goals?: number;
  simulation_minute?: number;
  match_state?: MatchState;
  markets: Market[];
};

export type Position = {
  id: string;
  user_id: string;
  market_id: string;
  outcome_id: string;
  shares: number;
  avg_price: number;
  amount_spent: number;
  outcomes: Outcome;
  markets: { 
    id: string;
    type: string;
    status: string;
    matches: { title: string } 
  };
};

export type Profile = {
  id: string;
  usdc_balance: number;
  email?: string;
  created_at: string;
};

export type Trade = {
  id: number;
  user_id: string;
  market_id: string;
  outcome_id: string;
  side: 'buy' | 'sell';
  shares: number;
  price: number;
  amount: number;
  ts: string;
};

export type OrderBookEntry = {
  price: number;
  size: number;
  side: 'buy' | 'sell';
  count: number;
};

export type HistoryPoint = {
  timestamp: Date;
  price: number;
  volume: number;
};
