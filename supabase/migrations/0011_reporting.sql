-- One caller-scoped SQL snapshot; no aggregate cache, implicit conversion or writes.
create function public.pse_report(p_year integer,p_quarter integer,p_month integer,p_employee_id text,p_vertical_id text,p_currency text)
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
  receipt_cells as(select employee_id,target_vertical_id as vertical_id,sum(amount) as amount,count(*)::integer as count from receipts group by employee_id,target_vertical_id),
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
  target as(select case when p_month>0 then null when employee is null and p_vertical_id='' then
    case when p_quarter=0 then(select annual_amount from plan) else(select q.amount from public.target_quarters q join plan p on p.id=q.plan_id where q.quarter=p_quarter)end
    else(select sum(amount) from cells)end as amount)
  select jsonb_build_object(
    'generated_at',statement_timestamp(),'currency',p_currency,'start_date',first_day,'end_date_exclusive',end_day,
    'fundraising',jsonb_build_object(
      'target',(select amount::text from target),'target_status',(select status from plan),'plan_id',(select id from plan),
      'actual',(select coalesce(sum(amount),0)::text from receipts),'receipt_count',(select count(*)::integer from receipts),
      'unassigned_actual',(select coalesce(sum(amount),0)::text from receipts where target_vertical_id is null),
      'types',(select jsonb_agg(jsonb_build_object('key',t.kind,'amount',coalesce(r.amount,0)::text,'count',coalesce(r.count,0))order by t.kind)
        from(values('cash'),('valued_in_kind'))t(kind)left join(select contribution_type,sum(amount)as amount,count(*)::integer as count from receipts group by contribution_type)r on r.contribution_type=t.kind),
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
    'trends',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(m.month,'YYYY-MM'),'actual',coalesce(r.amount,0)::text,'activities',coalesce(w.count,0),'completed_activities',coalesce(w.done,0),'meetings',coalesce(mt.count,0),'done_meetings',coalesce(mt.done,0))order by m.month)from months m left join money_months r using(month)left join work_months w using(month)left join meeting_months mt using(month)),'[]'::jsonb)
  )into result;
  return result;
end; $$;
revoke all on function public.pse_report(integer,integer,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.pse_report(integer,integer,integer,text,text,text) to authenticated;
