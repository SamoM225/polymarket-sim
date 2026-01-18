CREATE OR REPLACE FUNCTION public.buy_outcome(
  p_market_id uuid,
  p_outcome_id uuid,
  p_investment_usdc numeric,
  p_user_id uuid,
  p_bet_type text DEFAULT 'YES',
  p_min_shares_out numeric DEFAULT 0,    
  p_accept_new_odds boolean DEFAULT false 
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_market record;
  v_outcome_pool numeric;
  
  -- Fee & Risk
  v_fee_rate numeric := 0.02; -- Základný poplatok 2%
  v_fee_amount numeric;
  v_net_investment numeric;
  
  -- Velocity Guard (Nové premenné)
  v_outcome_vol_5min numeric;
  v_total_pressure numeric; -- (Volume za 5 min + Aktuálny vklad)
  v_is_risk boolean := false;
  
  -- FPMM
  v_new_pool_size numeric;
  v_shares_out numeric;
  v_price_per_share numeric;
  v_user_balance numeric;
  v_other_pool numeric;
  
  -- Max Bet Limit
  v_max_bet numeric;
BEGIN
  -- 1. VALIDÁCIE & LOCKS
  select * into v_market from public.markets where id = p_market_id for update;
  
  if v_market.status != 'OPEN' then 
    return json_build_object('success', false, 'error', 'MARKET_CLOSED'); 
  end if;

  -- 1.5 KONTROLA MAXIMÁLNEJ STÁVKY (15% Liquidity) - Hard Limit
  v_max_bet := v_market.liquidity_usdc * 0.15;
  
  -- Ošetrenie: Ak je likvidita dostatočná, nedovolíme jednorazovo obrovskú stávku
  IF v_market.liquidity_usdc > 100 AND p_investment_usdc > v_max_bet THEN
      RETURN json_build_object(
        'success', false, 
        'error', 'MAX_BET_EXCEEDED', 
        'limit', v_max_bet,
        'message', 'Bet exceeds 15% of market liquidity.'
      );
  END IF;

  select usdc_balance into v_user_balance from public.profiles where id = p_user_id;
  if v_user_balance < p_investment_usdc then 
    return json_build_object('success', false, 'error', 'INSUFFICIENT_BALANCE'); 
  end if;

  select pool into v_outcome_pool from public.outcomes where id = p_outcome_id;
  if v_outcome_pool is null then 
    return json_build_object('success', false, 'error', 'OUTCOME_NOT_FOUND'); 
  end if;

  -- =================================================================
  -- 2. VELOCITY GUARD (Pool Depth Logic)
  -- =================================================================
  
  -- A) Zistíme objem peňazí, ktorý pretiekol CEZ TENTO OUTCOME za posledných 5 minút
  SELECT COALESCE(sum(amount), 0) INTO v_outcome_vol_5min
  FROM public.trades
  WHERE market_id = p_market_id 
    AND outcome_id = p_outcome_id
    AND created_at > (now() - interval '5 minutes');

  -- B) Spočítame celkový tlak (História + Aktuálny vklad)
  v_total_pressure := v_outcome_vol_5min + p_investment_usdc;

  -- C) Logika Triggeru:
  --    Podmienka 1: Tlak musí byť väčší ako 2% CELKOVEJ likvidity marketu (aby sme ignorovali malé stávky)
  --    Podmienka 2: Tlak musí byť väčší ako 20% POOLU daného outcomu (to značí vyčerpanie/paniku)
  
  IF v_total_pressure > (v_market.liquidity_usdc * 0.02) THEN
      
      IF v_total_pressure > (v_outcome_pool * 0.20) THEN
          v_is_risk := true;
          v_fee_rate := 0.10; -- Panic Fee zapnuté
      END IF;
      
  END IF;

  -- =================================================================
  -- 3. VÝPOČET FPMM
  -- =================================================================

  v_fee_amount := p_investment_usdc * v_fee_rate;
  v_net_investment := p_investment_usdc - v_fee_amount;

  v_new_pool_size := v_outcome_pool;
  FOR v_other_pool IN 
    SELECT pool FROM public.outcomes WHERE market_id = p_market_id AND id != p_outcome_id 
  LOOP
     v_new_pool_size := v_new_pool_size * (v_other_pool / (v_other_pool + v_net_investment));
  END LOOP;

  v_shares_out := v_outcome_pool - v_new_pool_size;
  v_price_per_share := p_investment_usdc / NULLIF(v_shares_out, 0);

  -- 4. OCHRANA PROTI SLIPPAGE
  IF v_shares_out < p_min_shares_out AND p_accept_new_odds = false THEN
     RETURN json_build_object(
        'success', false,
        'error', 'SLIPPAGE_DETECTED',
        'expected_shares', p_min_shares_out,
        'new_shares', v_shares_out,
        'new_price', v_price_per_share,
        'message', 'Price changed. Please confirm new odds.'
     );
  END IF;

  -- 5. UPDATE DB
  UPDATE public.outcomes SET pool = pool + v_net_investment WHERE market_id = p_market_id AND id != p_outcome_id;
  
  -- Update poolu a zápis aktuálneho fee rate (aby to videl Frontend cez Realtime)
  UPDATE public.outcomes 
  SET pool = v_new_pool_size, current_fee_rate = v_fee_rate 
  WHERE id = p_outcome_id;
  
  UPDATE public.markets 
  SET liquidity_usdc = liquidity_usdc + v_net_investment, fees_collected_usdc = COALESCE(fees_collected_usdc, 0) + v_fee_amount 
  WHERE id = p_market_id;

  UPDATE public.profiles SET usdc_balance = usdc_balance - p_investment_usdc WHERE id = p_user_id;

  INSERT INTO public.positions (user_id, market_id, outcome_id, shares, amount_spent)
  VALUES (p_user_id, p_market_id, p_outcome_id, v_shares_out, p_investment_usdc)
  ON CONFLICT (user_id, outcome_id) 
  DO UPDATE SET shares = positions.shares + EXCLUDED.shares, amount_spent = positions.amount_spent + EXCLUDED.amount_spent;

  INSERT INTO public.trades (user_id, market_id, outcome_id, side, shares, price, amount, fee_amount) 
  VALUES (p_user_id, p_market_id, p_outcome_id, 'buy', v_shares_out, v_price_per_share, p_investment_usdc, v_fee_amount);

  RETURN json_build_object(
    'success', true,
    'shares_bought', v_shares_out,
    'price', v_price_per_share,
    'fee_charged', v_fee_amount,
    'risk_active', v_is_risk
  );

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', 'INTERNAL_ERROR', 'details', SQLERRM);
END;
$$;