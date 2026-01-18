-- =========================================================
--
-- Trade quote - dotaz na simuláciu obchodu a získanie ceny za akciu a počtu akcií za daný vklad
-- Slúži pre zobrazenie ceny pred samotným obchodom (buy/sell) a následne vypočitanie +- akceptovania sumy (ak sa rapídne zmení kurz)
--
-- =========================================================

CREATE OR REPLACE FUNCTION public.get_trade_quote(
  p_market_id uuid,
  p_outcome_id uuid,
  p_investment_usdc numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_outcome_pool numeric;
  
  -- Fee & Risk
  v_fee_rate numeric := 0.02; -- Default 2%
  v_net_investment numeric;
  
  -- Velocity Check
  v_total_vol_5min numeric;
  v_outcome_vol_5min numeric;
  v_ratio numeric;
  
  -- Výstup
  v_new_pool_size numeric;
  v_shares_out numeric;
  v_other_pool numeric;
  v_effective_price numeric; -- TOTO JE KĽÚČOVÁ HODNOTA
  v_odds_decimal numeric;    -- Kurz (napr. 2.50)
BEGIN
  -- 1. Načítanie poolu
  select pool into v_outcome_pool from public.outcomes where id = p_outcome_id;
  if v_outcome_pool is null then return json_build_object('error', 'Outcome not found'); end if;

  -- 2. VELOCITY GUARD (Skrytá logika)
  SELECT COALESCE(sum(amount), 0) INTO v_total_vol_5min
  FROM public.trades
  WHERE market_id = p_market_id AND created_at > (now() - interval '5 minutes');

  IF v_total_vol_5min > 50 THEN
      SELECT COALESCE(sum(amount), 0) INTO v_outcome_vol_5min
      FROM public.trades
      WHERE market_id = p_market_id AND outcome_id = p_outcome_id AND created_at > (now() - interval '5 minutes');

      v_ratio := (v_outcome_vol_5min + p_investment_usdc) / (v_total_vol_5min + p_investment_usdc);

      -- Ak je podozrivý volume, dvíhame fee (tým zhoršujeme kurz)
      IF v_ratio > 0.85 THEN
          v_fee_rate := 0.10; 
      END IF;
  END IF;

  -- 3. Výpočet Net Investment (Skryté strhnutie fee)
  v_net_investment := p_investment_usdc * (1 - v_fee_rate);

  -- 4. FPMM Simulácia
  v_new_pool_size := v_outcome_pool;
  FOR v_other_pool IN SELECT pool FROM public.outcomes WHERE market_id = p_market_id AND id != p_outcome_id LOOP
     v_new_pool_size := v_new_pool_size * (v_other_pool / (v_other_pool + v_net_investment));
  END LOOP;

  v_shares_out := v_outcome_pool - v_new_pool_size;

  -- 5. VÝPOČET EFEKTÍVNEJ CENY A KURZU
  -- Cena = Vklad / Počet akcií
  v_effective_price := p_investment_usdc / NULLIF(v_shares_out, 0);
  
  -- Kurz (Decimal Odds) = 1 / Cena (resp. Vklad / Cena, ale tu Shares/Vklad * Vklad... zjednodušene Shares / Vklad ak je 1$ base, ale user chce Decimal Odds)
  -- Decimal Odds = Payout (1$) / Cena za akciu
  -- Alebo jednoducho: 1 / v_effective_price
  v_odds_decimal := 1 / NULLIF(v_effective_price, 0);

  RETURN json_build_object(
    'shares', v_shares_out,
    'price_per_share', v_effective_price,  -- TOTO zobrazíš (napr. 0.60$)
    'odds_decimal', v_odds_decimal,        -- ALEBO TOTO (napr. 1.66)
    'fee_rate_debug', v_fee_rate           -- Len pre tvoje info, FE to schová
  );
END;
$$;