-- =============================
--
--  NEPOUŽÍVAŤ - market sa hýbe sám podľa stávok uživateľov
--  Simulovanie AMM - automatický rebalance po góle - zrušené
--
-- =============================
create or replace function public.trigger_goal_event(
  p_match_id uuid,
  p_scoring_team text -- 'HOME' alebo 'AWAY'
)
returns json
language plpgsql
security definer
as $$
declare
  v_market record;
  v_match record;

  -- Skóre
  v_new_home_score int;
  v_new_away_score int;
  v_goal_diff int;

  -- Pravdepodobnosti
  v_prob_home numeric;
  v_prob_draw numeric;
  v_prob_away numeric;

  -- CPMM
  v_outcome_rec record;
  v_prob_product numeric := 1;
  v_scaling_factor numeric;
  v_k numeric;

begin
  -- 1. ZÁMOK RIADKOV (Aby sa nič nemenilo počas výpočtu)
  select * into v_match from public.matches where id = p_match_id for update;
  select * into v_market from public.markets where match_id = p_match_id and type = '1X2' for update;

  if v_market is null then raise exception 'Market not found'; end if;

  -- 2. UPDATE SKÓRE
  if p_scoring_team = 'HOME' then
    v_new_home_score := v_match.home_goals + 1;
    v_new_away_score := v_match.away_goals;
    update public.matches set home_goals = v_new_home_score where id = p_match_id;
  elsif p_scoring_team = 'AWAY' then
    v_new_home_score := v_match.home_goals;
    v_new_away_score := v_match.away_goals + 1;
    update public.matches set away_goals = v_new_away_score where id = p_match_id;
  else
    raise exception 'Invalid team';
  end if;

  -- 3. VÝPOČET NOVÝCH PRAVDEPODOBNOSTÍ (Hardcoded logika pre gól)
  v_goal_diff := v_new_home_score - v_new_away_score;

  IF v_goal_diff = 0 THEN
      v_prob_home := 0.36; v_prob_draw := 0.30; v_prob_away := 0.34;
  ELSIF v_goal_diff = 1 THEN
      v_prob_home := 0.65; v_prob_draw := 0.25; v_prob_away := 0.10;
  ELSIF v_goal_diff = 2 THEN
      v_prob_home := 0.88; v_prob_draw := 0.08; v_prob_away := 0.04;
  ELSIF v_goal_diff >= 3 THEN
      v_prob_home := 0.98; v_prob_draw := 0.01; v_prob_away := 0.01;
  ELSIF v_goal_diff = -1 THEN
      v_prob_home := 0.10; v_prob_draw := 0.25; v_prob_away := 0.65;
  ELSIF v_goal_diff = -2 THEN
      v_prob_home := 0.04; v_prob_draw := 0.08; v_prob_away := 0.88;
  ELSIF v_goal_diff <= -3 THEN
      v_prob_home := 0.01; v_prob_draw := 0.01; v_prob_away := 0.98;
  END IF;

  -- 4. REBALANCE (Active AMM - Prepisujeme pooly)
  v_k := v_market.k_constant;

  FOR v_outcome_rec IN select id, outcome_slug from public.outcomes where market_id = v_market.id
  LOOP
    IF v_outcome_rec.outcome_slug = 'home' THEN v_prob_product := v_prob_product * v_prob_home;
    ELSIF v_outcome_rec.outcome_slug = 'draw' THEN v_prob_product := v_prob_product * v_prob_draw;
    ELSIF v_outcome_rec.outcome_slug = 'away' THEN v_prob_product := v_prob_product * v_prob_away;
    END IF;
  END LOOP;

  v_scaling_factor := power(v_k * v_prob_product, 1.0/3.0);

  UPDATE public.outcomes SET pool = v_scaling_factor / v_prob_home WHERE market_id = v_market.id AND outcome_slug = 'home';
  UPDATE public.outcomes SET pool = v_scaling_factor / v_prob_draw WHERE market_id = v_market.id AND outcome_slug = 'draw';
  UPDATE public.outcomes SET pool = v_scaling_factor / v_prob_away WHERE market_id = v_market.id AND outcome_slug = 'away';
  
  UPDATE public.markets 
  SET 
    status = 'LOCKED'  -- Market je pozastavený
  WHERE id = v_market.id;

  return json_build_object(
    'success', true,
    'new_score', format('%s:%s', v_new_home_score, v_new_away_score),
    'market_status', 'LOCKED',
    'message', 'Goal handled. Market is LOCKED waiting for manual unlock.'
  );
end;
$$;