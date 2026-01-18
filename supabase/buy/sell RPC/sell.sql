-- Veľmi stručná a jasná funkcia na predaj (sell)
CREATE OR REPLACE FUNCTION public.sell_outcome(
  p_market_id uuid,
  p_outcome_id uuid,
  p_shares numeric,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_shares numeric;
  v_price_per_share numeric := 1.0; -- jednoduchá logika, 1 USDC za akciu
  v_fee_rate numeric := 0.02;
  v_fee numeric;
  v_total numeric;
BEGIN
  -- Skontroluj, či má užívateľ dosť akcií
  SELECT shares INTO v_user_shares FROM public.positions WHERE user_id = p_user_id AND outcome_id = p_outcome_id;
  IF v_user_shares IS NULL OR v_user_shares < p_shares THEN
    RETURN json_build_object('success', false, 'error', 'NEDOSTATOK_AKCIÍ');
  END IF;

  -- Výpočet výnosu a poplatku
  v_total := p_shares * v_price_per_share;
  v_fee := v_total * v_fee_rate;

  -- Update pozície a zostatku
  UPDATE public.positions SET shares = shares - p_shares WHERE user_id = p_user_id AND outcome_id = p_outcome_id;
  UPDATE public.profiles SET usdc_balance = usdc_balance + (v_total - v_fee) WHERE id = p_user_id;

  -- Záznam o obchode
  INSERT INTO public.trades (user_id, market_id, outcome_id, side, shares, price, amount, fee_amount)
  VALUES (p_user_id, p_market_id, p_outcome_id, 'sell', p_shares, v_price_per_share, v_total, v_fee);

  RETURN json_build_object('success', true, 'predané_akcie', p_shares, 'výnos', v_total - v_fee, 'poplatok', v_fee);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;