-- Manager-only corrections for recognized contributions (decided 28 October 2026). Contributions stay
-- append-only: a correction is a new negative row that points at the original and carries a reason. It inherits
-- the original's opportunity, employee, vertical, currency, type and recognition time, so it nets out in the same
-- reporting period. The original is never edited, a receipt's running net never goes below zero, and a correction
-- cannot itself be corrected. Totals already sum amounts, so they net automatically; receipt counts exclude
-- corrections (pse_report below).
alter table public.recognized_contributions
  add column corrects_contribution_id uuid references public.recognized_contributions(id) on delete restrict,
  add column correction_reason text;
alter table public.recognized_contributions drop constraint recognized_contributions_amount_check;
alter table public.recognized_contributions
  add constraint recognized_contributions_amount_check check (
    amount <> 0 and abs(amount) <= 999999999999.99 and (amount > 0) = (corrects_contribution_id is null)
  ),
  add constraint recognized_contributions_correction_reason check (
    (corrects_contribution_id is null and correction_reason is null)
    or (corrects_contribution_id is not null and nullif(btrim(correction_reason), '') is not null
      and length(correction_reason) <= 2000)
  );
create index contributions_corrects_idx on public.recognized_contributions(corrects_contribution_id)
  where corrects_contribution_id is not null;

-- The 0012 rules for receipts, plus the correction rules. A correction skips the stage, active-employee and
-- active-vertical checks on purpose: a mistake or refund must stay correctable after a deal closes or a person
-- or vertical becomes inactive. It must instead match the original exactly.
create or replace function private.validate_contribution()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare source_opportunity public.opportunities%rowtype; source_stage public.pipeline_stages%rowtype;
  original public.recognized_contributions%rowtype; net numeric;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Recognized contributions are append-only; record a correction instead' using errcode = '23514';
  end if;
  if new.corrects_contribution_id is not null then
    if not private.is_target_manager() then
      raise exception 'Only an authorized PSE manager can correct a contribution' using errcode = '42501';
    end if;
    -- Locking the original serializes concurrent corrections, so the running net is checked against them all.
    select * into original from public.recognized_contributions where id = new.corrects_contribution_id for update;
    if original.id is null then
      raise exception 'Contribution to correct not found' using errcode = 'P0002';
    end if;
    if original.corrects_contribution_id is not null then
      raise exception 'A correction cannot itself be corrected' using errcode = '23514';
    end if;
    if (new.opportunity_id, new.employee_id, new.currency, new.contribution_type, new.recognized_at)
        is distinct from
        (original.opportunity_id, original.employee_id, original.currency, original.contribution_type, original.recognized_at)
      or new.target_vertical_id is distinct from original.target_vertical_id then
      raise exception 'A correction must keep the original contribution''s attribution and recognition time'
        using errcode = '23514';
    end if;
    select original.amount + coalesce(sum(c.amount), 0) + new.amount into net
      from public.recognized_contributions c where c.corrects_contribution_id = original.id;
    if net < 0 then
      raise exception 'Corrections cannot take a contribution below zero' using errcode = '23514';
    end if;
    return new;
  end if;
  perform private.require_active_pse(new.employee_id);
  select * into source_opportunity from public.opportunities where id = new.opportunity_id for share;
  if new.currency is distinct from source_opportunity.currency
    or new.contribution_type is distinct from source_opportunity.contribution_type then
    raise exception 'Contribution currency and type must match the opportunity; no implicit conversion' using errcode = '23514';
  end if;
  select * into source_stage from public.pipeline_stages where id = source_opportunity.stage_id;
  if source_stage.is_closed and source_stage.outcome is distinct from 'won' then
    raise exception 'Contributions can only be recorded on open or won opportunities' using errcode = '23514';
  end if;
  if new.target_vertical_id is not null and not exists (
    select 1 from public.target_verticals where id = new.target_vertical_id and active
  ) then
    raise exception 'Select an active target vertical' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Records a correction of p_amount (entered as a positive amount to reverse) against p_original_id. A stable
-- submission ID makes retries safe, as for record_contribution; a reused ID with different values conflicts.
create function public.correct_contribution(p_id uuid, p_original_id uuid, p_amount text, p_reason text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare existing public.recognized_contributions%rowtype; original public.recognized_contributions%rowtype;
begin
  if not private.is_target_manager() then raise exception 'Authorized manager required' using errcode='42501'; end if;
  if coalesce(p_amount,'') !~ '^\d{1,12}(\.\d{1,2})?$' or p_amount::numeric <= 0 then
    raise exception 'Invalid correction amount' using errcode='23514';
  end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null or length(p_reason) > 2000 then
    raise exception 'A correction needs a reason' using errcode='23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
  select * into existing from public.recognized_contributions where id=p_id;
  if existing.id is not null then
    if existing.recorded_by is distinct from auth.uid() or existing.corrects_contribution_id is distinct from p_original_id
      or existing.amount <> -(p_amount::numeric) or existing.correction_reason is distinct from btrim(p_reason) then
      raise exception 'Submission already used for a different correction' using errcode='23505';
    end if;
    return p_id;
  end if;
  select * into original from public.recognized_contributions where id=p_original_id;
  if original.id is null then raise exception 'Contribution to correct not found' using errcode='P0002'; end if;
  insert into public.recognized_contributions(id,opportunity_id,employee_id,target_vertical_id,amount,currency,recognized_at,
    contribution_type,approved_value_note,valuation_reference_url,notes,recorded_by,corrects_contribution_id,correction_reason)
  values(p_id,original.opportunity_id,original.employee_id,original.target_vertical_id,-(p_amount::numeric),original.currency,
    original.recognized_at,original.contribution_type,original.approved_value_note,original.valuation_reference_url,null,
    auth.uid(),p_original_id,btrim(p_reason));
  return p_id;
end; $$;
revoke all on function public.correct_contribution(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.correct_contribution(uuid,uuid,text,text) to authenticated;

-- pse_report as in 0014, with corrections left out of every receipt count (their amounts still net the totals).
create or replace function public.pse_report(p_year integer,p_quarter integer,p_month integer,p_employee_id text,p_vertical_id text,p_currency text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare first_day date; end_day date; first_instant timestamptz; end_instant timestamptz; employee uuid; vertical uuid; result jsonb;
begin
  if not private.is_pse_member() then raise exception 'Active PSE access required' using errcode='42501'; end if;
  if p_year is null or p_year<1 or p_year>9998 or p_quarter is null or p_quarter<0 or p_quarter>4
    or p_month is null or p_month<0 or p_month>12 or (p_quarter>0 and p_month>0)
    or p_currency is null or p_currency !~ '^[A-Z]{3}$' or p_employee_id is null or p_vertical_id is null then
    raise exception 'Invalid report filters' using errcode='22023';
  end if;
  employee:=nullif(p_employee_id,'')::uuid;
  vertical:=case when p_vertical_id in('','unassigned') then null else p_vertical_id::uuid end;
  first_day:=make_date(p_year,case when p_month>0 then p_month when p_quarter>0 then (p_quarter-1)*3+1 else 1 end,1);
  end_day:=(first_day+case when p_month>0 then interval '1 month' when p_quarter>0 then interval '3 months' else interval '1 year' end)::date;
  first_instant:=first_day::timestamp at time zone 'Asia/Dhaka'; end_instant:=end_day::timestamp at time zone 'Asia/Dhaka';
  with
  plan as(select * from public.target_plans where year=p_year and currency=p_currency),
  cells as(
    select a.employee_id,a.vertical_id,sum(a.amount) as amount from public.target_allocations a join plan p on p.id=a.plan_id
    where p_month=0 and (p_quarter=0 or a.quarter=p_quarter) and (employee is null or a.employee_id=employee)
      and (p_vertical_id='' or a.vertical_id=vertical) group by a.employee_id,a.vertical_id
  ),
  receipts as(
    select r.* from public.recognized_contributions r where r.currency=p_currency and r.recognized_at>=first_instant and r.recognized_at<end_instant
      and (employee is null or r.employee_id=employee)
      and (p_vertical_id='' or (p_vertical_id='unassigned' and r.target_vertical_id is null) or r.target_vertical_id=vertical)
  ),
  receipt_cells as(select employee_id,target_vertical_id as vertical_id,sum(amount) as amount,count(*)filter(where corrects_contribution_id is null)::integer as count from receipts group by employee_id,target_vertical_id),
  comparison as(
    select coalesce(a.employee_id,r.employee_id) as employee_id,coalesce(a.vertical_id,r.vertical_id) as vertical_id,
      a.amount::text as target,coalesce(r.amount,0)::text as actual,coalesce(r.count,0) as receipt_count
    from cells a full join receipt_cells r on a.employee_id=r.employee_id and a.vertical_id is not distinct from r.vertical_id
  ),
  pipeline as(
    select o.*,s.name as stage_name,s.position,s.is_provisional,coalesce(s.outcome,'open') as outcome
    from public.opportunities o join public.pipeline_stages s on s.id=o.stage_id
    where o.currency=p_currency and (employee is null or o.owner_id=employee) and o.expected_close_at>=first_day and o.expected_close_at<end_day
  ),
  activity_scope as(select * from public.activities where employee is null or owner_id=employee),
  work as(select * from activity_scope where occurred_at>=first_instant and occurred_at<end_instant),
  meetings as(select * from public.meetings where scheduled_at>=first_instant and scheduled_at<end_instant and (employee is null or owner_id=employee)),
  months as(select date_trunc('month',d)::date as month from generate_series(first_day::timestamp,end_day::timestamp-interval '1 day',interval '1 month')d),
  money_months as(select date_trunc('month',recognized_at at time zone 'Asia/Dhaka')::date as month,sum(amount) as amount from receipts group by 1),
  work_months as(select date_trunc('month',occurred_at at time zone 'Asia/Dhaka')::date as month,count(*)::integer as count,count(*)filter(where status='done')::integer as done from work group by 1),
  meeting_months as(select date_trunc('month',scheduled_at at time zone 'Asia/Dhaka')::date as month,count(*)::integer as count,count(*)filter(where status='done')::integer as done from meetings group by 1),
  owner_work as(select owner_id,count(*)::integer as activities,count(*)filter(where status='done')::integer as done from work group by owner_id),
  owner_meetings as(select owner_id,count(*)::integer as meetings,count(*)filter(where status='done')::integer as done from meetings group by owner_id),
  engaged as(
    select m.owner_id,coalesce(m.contact_id,o.primary_contact_id,o.contact_id) as contact_id
    from meetings m left join public.opportunities o on o.id=m.opportunity_id where m.status='done'
    union all
    select w.owner_id,coalesce(w.contact_id,mt.contact_id,o.primary_contact_id,o.contact_id)
    from work w left join public.meetings mt on mt.id=w.meeting_id
    left join public.opportunities o on o.id=coalesce(w.opportunity_id,mt.opportunity_id) where w.status='done'
  ),
  engaged_contacts as(select distinct e.owner_id,e.contact_id,c.kind from engaged e join public.contacts c on c.id=e.contact_id),
  target as(select case when p_month>0 then null when employee is null and p_vertical_id='' then
    case when p_quarter=0 then(select annual_amount from plan) else(select q.amount from public.target_quarters q join plan p on p.id=q.plan_id where q.quarter=p_quarter)end
    else(select sum(amount) from cells)end as amount)
  select jsonb_build_object(
    'generated_at',statement_timestamp(),'currency',p_currency,'start_date',first_day,'end_date_exclusive',end_day,
    'fundraising',jsonb_build_object(
      'target',(select amount::text from target),'target_status',(select status from plan),'plan_id',(select id from plan),
      'actual',(select coalesce(sum(amount),0)::text from receipts),'receipt_count',(select count(*)filter(where corrects_contribution_id is null)::integer from receipts),
      'unassigned_actual',(select coalesce(sum(amount),0)::text from receipts where target_vertical_id is null),
      'types',(select jsonb_agg(jsonb_build_object('key',t.kind,'amount',coalesce(r.amount,0)::text,'count',coalesce(r.count,0))order by t.kind)
        from(values('cash'),('valued_in_kind'))t(kind)left join(select contribution_type,sum(amount)as amount,count(*)filter(where corrects_contribution_id is null)::integer as count from receipts group by contribution_type)r on r.contribution_type=t.kind),
      'dimensions',coalesce((select jsonb_agg(jsonb_build_object('employee_id',c.employee_id,'employee_name',coalesce(p.display_name,'Historical employee'),'vertical_id',c.vertical_id,'vertical_name',coalesce(v.name,'Unassigned'),'target',c.target,'actual',c.actual,'receipt_count',c.receipt_count)order by c.employee_id,c.vertical_id)from comparison c left join public.profiles p on p.id=c.employee_id left join public.target_verticals v on v.id=c.vertical_id),'[]'::jsonb)
    ),
    'pipeline',jsonb_build_object(
      'count',(select count(*)::integer from pipeline),'expected',(select coalesce(sum(expected_amount),0)::text from pipeline),
      'undated_count',(select count(*)::integer from public.opportunities where currency=p_currency and expected_close_at is null and(employee is null or owner_id=employee)),
      'undated_expected',(select coalesce(sum(expected_amount),0)::text from public.opportunities where currency=p_currency and expected_close_at is null and(employee is null or owner_id=employee)),
      'stages',coalesce((select jsonb_agg(to_jsonb(g)order by g.position,g.id)from(select stage_id as id,stage_name as name,position,is_provisional,outcome,count(*)::integer as count,sum(expected_amount)::text as expected from pipeline group by stage_id,stage_name,position,is_provisional,outcome)g),'[]'::jsonb),
      'outcomes',(select jsonb_agg(jsonb_build_object('key',t.kind,'count',coalesce(r.count,0),'expected',coalesce(r.amount,0)::text)order by t.kind)from(values('open'),('won'),('lost'),('abandoned'),('junk'))t(kind)left join(select outcome,count(*)::integer as count,sum(expected_amount)as amount from pipeline group by outcome)r on r.outcome=t.kind)
    ),
    'workload',jsonb_build_object(
      'activity_count',(select count(*)::integer from work),'meeting_count',(select count(*)::integer from meetings),
      'independent_count',(select count(*)::integer from work where contact_id is null and opportunity_id is null and meeting_id is null),
      'undated_activities',(select count(*)::integer from activity_scope where occurred_at is null),
      'missing_context',(select count(*)::integer from activity_scope where contact_id is null and opportunity_id is null and meeting_id is null and not(coalesce(related_person_name,'') ~ '[^[:space:]]') and not(coalesce(related_organization_name,'') ~ '[^[:space:]]')),
      'types',(select jsonb_agg(jsonb_build_object('key',t.kind,'count',coalesce(r.count,0))order by t.kind)from(values('task'),('email'),('call'),('meeting'),('event'),('campaign'),('proposal'),('visit'),('stewardship'),('prospect_engagement'),('general'))t(kind)left join(select activity_type,count(*)::integer as count from work group by activity_type)r on r.activity_type=t.kind),
      'statuses',(select jsonb_agg(jsonb_build_object('key',t.kind,'count',coalesce(r.count,0))order by t.kind)from(values('open'),('in_progress'),('done'),('cancelled'))t(kind)left join(select status,count(*)::integer as count from work group by status)r on r.status=t.kind),
      'categories',(select jsonb_agg(jsonb_build_object('key',t.kind,'count',coalesce(r.count,0))order by t.kind)from(values('stewardship'),('prospect_engagement'),('independent_general'))t(kind)left join(select work_category,count(*)::integer as count from work group by work_category)r on r.work_category=t.kind),
      'meeting_statuses',(select jsonb_agg(jsonb_build_object('key',t.kind,'count',coalesce(r.count,0))order by t.kind)from(values('scheduled'),('done'),('cancelled'))t(kind)left join(select status,count(*)::integer as count from meetings group by status)r on r.status=t.kind),
      'owners',coalesce((select jsonb_agg(jsonb_build_object('id',coalesce(w.owner_id,m.owner_id),'name',coalesce(p.display_name,'Historical owner'),'activities',coalesce(w.activities,0),'completed_activities',coalesce(w.done,0),'meetings',coalesce(m.meetings,0),'done_meetings',coalesce(m.done,0))order by coalesce(w.owner_id,m.owner_id))from owner_work w full join owner_meetings m on w.owner_id=m.owner_id left join public.profiles p on p.id=coalesce(w.owner_id,m.owner_id)),'[]'::jsonb)
    ),
    'engagement',jsonb_build_object(
      'contacts',(select count(distinct contact_id)::integer from engaged_contacts),
      'individuals',(select count(distinct contact_id)::integer from engaged_contacts where kind='individual'),
      'companies',(select count(distinct contact_id)::integer from engaged_contacts where kind='company'),
      'unlinked_named',(select count(*)::integer from work where status='done' and contact_id is null and opportunity_id is null and meeting_id is null and (coalesce(related_person_name,'') ~ '[^[:space:]]' or coalesce(related_organization_name,'') ~ '[^[:space:]]')),
      'owners',coalesce((select jsonb_agg(jsonb_build_object('id',g.owner_id,'name',coalesce(p.display_name,'Historical owner'),'contacts',g.contacts)order by g.owner_id)from(select owner_id,count(distinct contact_id)::integer as contacts from engaged_contacts group by owner_id)g left join public.profiles p on p.id=g.owner_id),'[]'::jsonb)
    ),
    'trends',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),'actual',coalesce(r.amount,0)::text,'activities',coalesce(w.count,0),'completed_activities',coalesce(w.done,0),'meetings',coalesce(mt.count,0),'done_meetings',coalesce(mt.done,0))order by m.month)from months m left join money_months r using(month)left join work_months w using(month)left join meeting_months mt using(month)),'[]'::jsonb)
  )into result;
  return result;
end; $$;
revoke all on function public.pse_report(integer,integer,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.pse_report(integer,integer,integer,text,text,text) to authenticated;
