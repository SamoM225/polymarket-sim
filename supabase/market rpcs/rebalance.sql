create or replace function public.rebalance_market(
  p_market_id uuid,
  p_new_probs jsonb -- očakávaný formát: {"outcome_uuid_1": 0.50, "outcome_uuid_2": 0.30....}
)
returns json
language plpgsql
security definer
as $$
declare
  v_market record;
  v_outcome_id text;
  v_prob numeric;

  -- CPMM 
  v_prob_product numeric := 1;
  v_outcomes_count int := 0;
  v_scaling_factor numeric;
  v_k numeric;
begin
  -- Uzamknutie marketu
  select * into v_market from public.markets where id = p_market_id for update;

  if v_market is null then raise exception 'Market not found'; end if;

  v_k := v_market.k_constant;

  -- Validacia a vypočty sučinu pravdepodobnosti
  -- JSON Loop - prejdeme získané probabilities
  FOR v_outcome_id, v_prob IN SELECT * FROM jsonb_each_text(p_new_probs)
  LOOP
    -- pretypovanie na numeric, ak by tak FE neučinil
    v_prob_product := v_prob_product * v_prob::numeric;
    v_outcomes_count := v_outcomes_count + 1;
  END LOOP;

  -- Kontrola pre dáta pre všetky outcomes
  if v_outcomes_count = 0 then raise exception 'No probs provided';
  end if;

  -- výpočet invariant k - scaling factor_id
  -- C = (k * product_probs)^(1/n)
  v_scaling_factor := power(v_k * v_prob_product, 1.0 / v_outcomes_count);

  -- virtual swap nových rezerv
  FOR v_outcome_id, v_prob IN SELECT * FROM jsonb_each_text(p_new_probs)
  LOOP
    UPDATE public.outcomes
    SET POOL = v_scaling_factor / v_prob::numeric
    WHERE id = v_outcome_id::uuid;
  END LOOP;


  return json_build_object(
    'success', true,
    'message', 'Market rebalanced to new odds'
  );
end;
$$;