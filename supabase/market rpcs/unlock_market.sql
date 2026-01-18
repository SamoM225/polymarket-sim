create or replace function public.unlock_market(
  p_market_id uuid default null,
  p_match_id uuid default null
)
returns json
language plpgsql
security definer
as $$
declare
  v_rows_affected int;
begin
  -- Validácia: Musíme mať aspoň jedno ID
  if p_market_id is null and p_match_id is null then
    raise exception 'Market_id or match_id required.';
  end if;

  -- Update Statusu
  UPDATE public.markets
  SET 
    status = 'OPEN'
  WHERE 
    -- Ak je zadané ID marketu, hľadáme konkrétny market
    (p_market_id IS NOT NULL AND id = p_market_id)
    OR
    -- Ak je zadané ID zápasu, hľadáme všetky markety k tomuto zápasu
    (p_match_id IS NOT NULL AND match_id = p_match_id);

  -- Zistíme, či sa niečo stalo
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  if v_rows_affected = 0 then
     return json_build_object('success', false, 'message', 'No markets found to unlock');
  end if;

  return json_build_object(
    'success', true, 
    'message', format('Market(s) unlocked. Count: %s', v_rows_affected)
  );
end;
$$;