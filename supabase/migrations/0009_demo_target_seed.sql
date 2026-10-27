-- Administrative demo tooling only. Never callable by browser/authenticated users.
-- Each missing plan and its children are inserted atomically; existing plans are untouched.
create function public.seed_demo_target(p_id uuid,p_values jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare item jsonb; creator uuid;
begin
  if p_id not in ('d6000000-0000-4000-8000-000000000001'::uuid,'d6000000-0000-4000-8000-000000000002'::uuid) then
    raise exception 'Reserved fictional demo plan ID required' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  if exists(select 1 from public.target_plans where id=p_id) then return false; end if;
  if jsonb_typeof(p_values) is distinct from 'object' or p_values-array['year','currency','annual_amount','created_by','quarters','allocations']<>'{}'::jsonb
    or not(p_values ?& array['year','currency','annual_amount','created_by','quarters','allocations'])
    or coalesce(p_values->>'annual_amount','') !~ '^\d{1,12}(\.\d{1,2})?$'
    or jsonb_typeof(p_values->'quarters') is distinct from 'array' or jsonb_array_length(p_values->'quarters')<>4
    or jsonb_typeof(p_values->'allocations') is distinct from 'array' or jsonb_array_length(p_values->'allocations')>4000 then
    raise exception 'Invalid fictional target snapshot' using errcode='23514';
  end if;
  creator:=(p_values->>'created_by')::uuid;
  if not exists(select 1 from public.profiles where id=creator and active and department='PSE' and role in('pse_manager','admin')) then
    raise exception 'Existing active PSE manager required' using errcode='23514';
  end if;
  insert into public.target_plans(id,year,currency,annual_amount,created_by)
  values(p_id,(p_values->>'year')::integer,p_values->>'currency',(p_values->>'annual_amount')::numeric,creator);
  for item in select value from jsonb_array_elements(p_values->'quarters') loop
    if item-array['quarter','amount']<>'{}'::jsonb or not(item ?& array['quarter','amount']) or coalesce(item->>'amount','') !~ '^\d{1,12}(\.\d{1,2})?$' then raise exception 'Invalid demo quarter' using errcode='23514'; end if;
    insert into public.target_quarters(plan_id,quarter,amount) values(p_id,(item->>'quarter')::smallint,(item->>'amount')::numeric);
  end loop;
  for item in select value from jsonb_array_elements(p_values->'allocations') loop
    if item-array['quarter','employee_id','vertical_id','amount']<>'{}'::jsonb or not(item ?& array['quarter','employee_id','vertical_id','amount']) or coalesce(item->>'amount','') !~ '^\d{1,12}(\.\d{1,2})?$' then raise exception 'Invalid demo allocation' using errcode='23514'; end if;
    insert into public.target_allocations(plan_id,quarter,employee_id,vertical_id,amount)
    values(p_id,(item->>'quarter')::smallint,(item->>'employee_id')::uuid,(item->>'vertical_id')::uuid,(item->>'amount')::numeric);
  end loop;
  return true;
end; $$;
revoke all on function public.seed_demo_target(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.seed_demo_target(uuid,jsonb) to service_role;
