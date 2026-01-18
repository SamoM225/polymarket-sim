-- Tabuľka pre admin notifikácie (oznámenia pre administrátorov)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  market_id uuid,
  type text NOT NULL,
  message text,
  created_at timestamp with time zone DEFAULT now(),
  is_resolved boolean DEFAULT false
);

-- Tabuľka pre štatistiky rebríčka (leaderboard)
CREATE TABLE IF NOT EXISTS public.leaderboards (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  period_type text NOT NULL, -- napr. 'daily', 'weekly', atď.
  period_key text NOT NULL,  -- napr. '2026-01-18'
  total_bets integer DEFAULT 0,
  won_bets integer DEFAULT 0,
  volume_usdc numeric DEFAULT 0,
  net_profit_usdc numeric DEFAULT 0,
  roi_percentage numeric DEFAULT 0,
  last_updated timestamp with time zone DEFAULT now()
);

-- Tabuľka pre trhy (markets)
CREATE TABLE IF NOT EXISTS public.markets (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  match_id uuid,
  type market_type NOT NULL, -- vlastný enum typ
  k_constant numeric NOT NULL,
  liquidity_usdc numeric DEFAULT 0 NOT NULL,
  status state_type DEFAULT 'OPEN'::state_type, -- vlastný enum typ
  outcome_resolved_id uuid,
  risk_multiplier numeric DEFAULT 1.0,
  fees_collected_usdc numeric DEFAULT 0
);

-- Tabuľka pre zápasy (matches)
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  home_team text,
  away_team text,
  home_goals numeric DEFAULT 0 NOT NULL,
  away_goals numeric DEFAULT 0 NOT NULL,
  start_time timestamp with time zone NOT NULL,
  status state_type DEFAULT 'OPEN'::state_type, -- vlastný enum typ
  simulation_minute integer DEFAULT 0,
  sport text,
  league text,
  match_state jsonb DEFAULT '{}'::jsonb -- ukladá dodatočné informácie o zápase
);

-- Tabuľka pre výsledky trhu (outcomes)
CREATE TABLE IF NOT EXISTS public.outcomes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  market_id uuid NOT NULL,
  outcome_slug text NOT NULL, -- napr. 'yes', 'no', 'draw'
  label text NOT NULL,
  pool numeric DEFAULT 0 NOT NULL,
  current_fee_rate numeric DEFAULT 0.02
);

-- Tabuľka pre pozície používateľov (positions)
CREATE TABLE IF NOT EXISTS public.positions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  market_id uuid NOT NULL,
  outcome_id uuid NOT NULL,
  shares numeric NOT NULL,
  avg_price numeric,
  amount_spent numeric DEFAULT 0 NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Tabuľka pre históriu cien (price_history)
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  market_id uuid NOT NULL,
  outcome_id uuid NOT NULL,
  price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Tabuľka pre profily používateľov (profiles)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  usdc_balance numeric DEFAULT 0 NOT NULL, -- mena s ktorou hráči hrajú
  username text
);

-- Tabuľka pre obchody (trades)
CREATE TABLE IF NOT EXISTS public.trades (
  id bigint DEFAULT nextval('trades_id_seq'::regclass) NOT NULL,
  user_id uuid NOT NULL,
  market_id uuid NOT NULL,
  outcome_id uuid NOT NULL,
  side text NOT NULL, -- 'buy' alebo 'sell'
  shares numeric NOT NULL,
  price numeric NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  fee_amount numeric DEFAULT 0.02 -- slúži pre fe -> nemusí počítať výsledok pre každý outcome, velocity guard upravuje túto hodnotu
);

-- Tabuľka pre cooldowny používateľov (uzamknutie obchodovania v trhu)
CREATE TABLE IF NOT EXISTS public.user_cooldowns (
  user_id uuid NOT NULL,
  market_id uuid NOT NULL,
  locked_until timestamp with time zone NOT NULL
);