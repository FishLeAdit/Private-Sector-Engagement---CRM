-- Atomic draft snapshots with stale-write protection; no target DELETE table grant.
create function public.save_target_draft(p_id uuid, p_values jsonb, p_expected_updated_at text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare existing public.target_plans%rowtype; q jsonb; a jsonb;
begin
  if not private.is_target_manager() then raise exception 'Authorized manager required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.target_plans where id=p_id for update;
  if existing.id is not null then
    if existing.status <> 'draft' then raise exception 'Approved targets are fixed' using errcode='23514'; end if;
    if nullif(p_expected_updated_at,'')::timestamptz is distinct from existing.updated_at then raise exception 'Draft has changed; reload it' using errcode='40001'; end if;
  elsif coalesce(p_expected_updated_at,'')<>'' then raise exception 'Target not found' using errcode='P0002'; end if;
  if jsonb_typeof(p_values) is distinct from 'object' or p_values - array['year','currency','annual_amount','quarters','allocations'] <> '{}'::jsonb
    or not (p_values ?& array['year','currency','annual_amount','quarters','allocations'])
    or coalesce(p_values->>'annual_amount','') !~ '^\d{1,12}(\.\d{1,2})?$'
    or jsonb_typeof(p_values->'quarters') is distinct from 'array' or jsonb_array_length(p_values->'quarters')<>4
    or jsonb_typeof(p_values->'allocations') is distinct from 'array' or jsonb_array_length(p_values->'allocations')>4000 then
    raise exception 'Invalid draft snapshot' using errcode='23514';
  end if;
  if existing.id is null then
    insert into public.target_plans(id,year,currency,annual_amount,created_by) values(p_id,(p_values->>'year')::integer,p_values->>'currency',(p_values->>'annual_amount')::numeric,auth.uid());
  else
    update public.target_plans set year=(p_values->>'year')::integer,currency=p_values->>'currency',annual_amount=(p_values->>'annual_amount')::numeric where id=p_id;
  end if;
  delete from public.target_allocations where plan_id=p_id;
  delete from public.target_quarters where plan_id=p_id;
  for q in select value from jsonb_array_elements(p_values->'quarters') loop
    if jsonb_typeof(q) is distinct from 'object' or q-array['quarter','amount'] <> '{}'::jsonb or not(q ?& array['quarter','amount']) or coalesce(q->>'amount','') !~ '^\d{1,12}(\.\d{1,2})?$' then raise exception 'Invalid quarter' using errcode='23514'; end if;
    insert into public.target_quarters(plan_id,quarter,amount) values(p_id,(q->>'quarter')::smallint,(q->>'amount')::numeric);
  end loop;
  for a in select value from jsonb_array_elements(p_values->'allocations') loop
    if jsonb_typeof(a) is distinct from 'object' or a-array['quarter','employee_id','vertical_id','amount'] <> '{}'::jsonb or not(a ?& array['quarter','employee_id','vertical_id','amount']) or coalesce(a->>'amount','') !~ '^\d{1,12}(\.\d{1,2})?$' then raise exception 'Invalid allocation' using errcode='23514'; end if;
    insert into public.target_allocations(plan_id,quarter,employee_id,vertical_id,amount) values(p_id,(a->>'quarter')::smallint,(a->>'employee_id')::uuid,(a->>'vertical_id')::uuid,(a->>'amount')::numeric);
  end loop;
  return p_id;
end; $$;

-- A stable submission ID makes retries safe without enabling contribution editing.
create function private.touch_target_parent()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.target_plans set updated_at=now() where id=case when tg_op='DELETE' then old.plan_id else new.plan_id end;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function private.touch_target_parent() from public,anon,authenticated;
create trigger touch_target_parent after insert or update or delete on public.target_quarters for each row execute function private.touch_target_parent();
create trigger touch_target_parent after insert or update or delete on public.target_allocations for each row execute function private.touch_target_parent();

create function public.approve_target_draft(p_plan_id uuid,p_expected_updated_at text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare stamp timestamptz;
begin
  if not private.is_target_manager() then raise exception 'Authorized manager required' using errcode='42501'; end if;
  select updated_at into stamp from public.target_plans where id=p_plan_id for update;
  if stamp is null then raise exception 'Target not found' using errcode='P0002'; end if;
  if stamp is distinct from nullif(p_expected_updated_at,'')::timestamptz then raise exception 'Draft has changed; reload before approval' using errcode='40001'; end if;
  return public.approve_target_plan(p_plan_id);
end; $$;

create function public.record_contribution(p_id uuid, p_values jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing public.recognized_contributions%rowtype; desired public.recognized_contributions%rowtype;
begin
  if not private.is_pse_member() then raise exception 'PSE access required' using errcode='42501'; end if;
  if jsonb_typeof(p_values) is distinct from 'object' or p_values-array['opportunity_id','employee_id','target_vertical_id','amount','currency','recognized_at','contribution_type','approved_value_note','valuation_reference_url','notes'] <> '{}'::jsonb or coalesce(p_values->>'amount','') !~ '^\d{1,12}(\.\d{1,2})?$' then raise exception 'Invalid contribution' using errcode='23514'; end if;
  desired:=jsonb_populate_record(null::public.recognized_contributions,p_values);
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.recognized_contributions where id=p_id;
  if existing.id is not null then
    if existing.recorded_by is distinct from auth.uid() or (to_jsonb(existing)-array['id','recorded_by','created_at','updated_at']) is distinct from (to_jsonb(desired)-array['id','recorded_by','created_at','updated_at']) then raise exception 'Submission already used for different contribution' using errcode='23505'; end if;
    return p_id;
  end if;
  insert into public.recognized_contributions(id,opportunity_id,employee_id,target_vertical_id,amount,currency,recognized_at,contribution_type,approved_value_note,valuation_reference_url,notes,recorded_by)
  values(p_id,desired.opportunity_id,desired.employee_id,desired.target_vertical_id,desired.amount,desired.currency,desired.recognized_at,desired.contribution_type,desired.approved_value_note,desired.valuation_reference_url,desired.notes,auth.uid());
  return p_id;
end; $$;

-- Aggregate every eligible actual in PostgreSQL, independent of REST pagination.
create function public.target_actuals(p_plan_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.is_pse_member() then raise exception 'PSE access required' using errcode='42501'; end if;
  if not exists(select 1 from public.target_plans where id=p_plan_id) then raise exception 'Target not found' using errcode='P0002'; end if;
  select coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb) into result from (
    select extract(quarter from r.recognized_at at time zone 'Asia/Dhaka')::integer as quarter,r.employee_id,r.target_vertical_id as vertical_id,sum(r.amount)::text as amount
    from public.recognized_contributions r join public.target_plans p on p.id=p_plan_id
    where r.currency=p.currency and extract(year from r.recognized_at at time zone 'Asia/Dhaka')=p.year
    group by 1,2,3 order by 1,2,3
  ) g;
  return result;
end; $$;
revoke all on function public.save_target_draft(uuid,jsonb,text),public.approve_target_draft(uuid,text),public.record_contribution(uuid,jsonb),public.target_actuals(uuid) from public,anon,authenticated;
grant execute on function public.save_target_draft(uuid,jsonb,text),public.approve_target_draft(uuid,text),public.record_contribution(uuid,jsonb),public.target_actuals(uuid) to authenticated;
