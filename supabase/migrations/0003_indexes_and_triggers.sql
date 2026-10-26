-- Internal functions are not exposed as callable PostgREST RPCs.
create function private.require_active_pse(p_employee_id uuid)
returns void language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = p_employee_id
    and active and department = 'PSE' and role in ('pse_member', 'pse_manager', 'admin')) then
    raise exception 'Employee must be an active PSE user' using errcode = '23514';
  end if;
end;
$$;

create function private.preserve_identity_and_timestamps()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new)->'id') is distinct from (to_jsonb(old)->'id')
      or (to_jsonb(new)->'created_by') is distinct from (to_jsonb(old)->'created_by')
      or (to_jsonb(new)->'recorded_by') is distinct from (to_jsonb(old)->'recorded_by')
      or new.created_at is distinct from old.created_at then
      raise exception 'Record identity, creator and creation time are immutable' using errcode = '23514';
    end if;
    if (to_jsonb(new)->'owner_id') is distinct from (to_jsonb(old)->'owner_id')
      and auth.uid() is not null and not private.is_target_manager() then
      raise exception 'Only an authorized manager may reassign ownership' using errcode = '42501';
    end if;
  else
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create function private.validate_contact_links()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.kind is distinct from old.kind then
    raise exception 'Contact kind is immutable; create the appropriate record instead' using errcode = '23514';
  end if;
  if new.company_id is not null and not exists (
    select 1 from public.contacts where id = new.company_id and kind = 'company'
  ) then
    raise exception 'Company association must reference a company contact' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- A company opportunity's individual points of contact are valid linked
-- meeting/activity contacts too. Merely sharing a free-text name is not enough.
create function private.opportunity_accepts_contact(p_opportunity_id uuid, p_contact_id uuid)
returns boolean language sql stable security definer
set search_path = ''
as $$
  select p_contact_id is null or exists (
    select 1 from public.opportunities o where o.id = p_opportunity_id
      and (p_contact_id = o.contact_id or p_contact_id = o.primary_contact_id or p_contact_id = o.secondary_contact_id)
  );
$$;

create function private.validate_opportunity_links()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare contact_kind text;
begin
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    perform private.require_active_pse(new.owner_id);
  end if;
  select kind into contact_kind from public.contacts where id = new.contact_id;
  if contact_kind = 'company' and new.primary_contact_id is null then
    raise exception 'Company opportunities require a primary individual contact' using errcode = '23514';
  end if;
  if new.primary_contact_id is not null and not exists (
    select 1 from public.contacts where id = new.primary_contact_id and kind = 'individual'
  ) then
    raise exception 'Primary contact must be an individual' using errcode = '23514';
  end if;
  if new.secondary_contact_id is not null and not exists (
    select 1 from public.contacts where id = new.secondary_contact_id and kind = 'individual'
  ) then
    raise exception 'Secondary contact must be an individual' using errcode = '23514';
  end if;
  if contact_kind = 'individual' and (
    (new.primary_contact_id is not null and new.primary_contact_id <> new.contact_id)
    or new.secondary_contact_id is not null
  ) then
    raise exception 'Individual opportunities use their linked individual as the point of contact' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    if not exists (select 1 from public.pipeline_stages where id = new.stage_id and active) then
      raise exception 'Select an active pipeline stage' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'INSERT' or new.contribution_category_id is distinct from old.contribution_category_id then
    if not exists (select 1 from public.contribution_categories where id = new.contribution_category_id and active) then
      raise exception 'Select an active contribution category' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    if (new.contact_id is distinct from old.contact_id
      or new.primary_contact_id is distinct from old.primary_contact_id
      or new.secondary_contact_id is distinct from old.secondary_contact_id) and exists (
      select 1 from (
        select m.contact_id from public.meetings m where m.opportunity_id = old.id
        union all
        select a.contact_id from public.activities a where a.opportunity_id = old.id
          or exists (select 1 from public.meetings m where m.id = a.meeting_id and m.opportunity_id = old.id)
        union all
        select m.contact_id from public.meetings m join public.activities a on a.meeting_id = m.id
          where a.opportunity_id = old.id
      ) linked where linked.contact_id is not null and linked.contact_id is distinct from new.contact_id
        and linked.contact_id is distinct from new.primary_contact_id and linked.contact_id is distinct from new.secondary_contact_id
    ) then
      raise exception 'Opportunity contact points conflict with existing meetings or activities' using errcode = '23514';
    end if;
    if exists (select 1 from public.recognized_contributions r where r.opportunity_id = old.id
      and (r.currency <> new.currency or r.contribution_type <> new.contribution_type)) then
      raise exception 'Opportunity currency/type must preserve recorded contribution attribution' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function private.validate_meeting_links()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare linked_activity record; effective_opportunity uuid;
begin
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    perform private.require_active_pse(new.owner_id);
  end if;
  if new.opportunity_id is not null then
    perform 1 from public.opportunities where id = new.opportunity_id for share;
    if not private.opportunity_accepts_contact(new.opportunity_id, new.contact_id) then
      raise exception 'Meeting contact must be the opportunity party or a designated contact point' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    for linked_activity in select contact_id, opportunity_id from public.activities where meeting_id = old.id loop
      if linked_activity.opportunity_id is not null and new.opportunity_id is not null
        and linked_activity.opportunity_id <> new.opportunity_id then
        raise exception 'Meeting changes conflict with existing activity opportunities' using errcode = '23514';
      end if;
      effective_opportunity := coalesce(linked_activity.opportunity_id, new.opportunity_id);
      if effective_opportunity is not null then
        perform 1 from public.opportunities where id = effective_opportunity for share;
        if not private.opportunity_accepts_contact(effective_opportunity, new.contact_id)
          or not private.opportunity_accepts_contact(effective_opportunity, linked_activity.contact_id) then
          raise exception 'Meeting changes conflict with existing activity contacts' using errcode = '23514';
        end if;
      elsif linked_activity.contact_id is not null and linked_activity.contact_id is distinct from new.contact_id then
        raise exception 'Meeting changes conflict with existing activity contacts' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create function private.validate_activity_links()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare meeting_contact uuid; meeting_opportunity uuid; effective_opportunity uuid;
begin
  if tg_op = 'INSERT' or new.owner_id is distinct from old.owner_id then
    perform private.require_active_pse(new.owner_id);
  end if;
  if new.opportunity_id is not null then
    perform 1 from public.opportunities where id = new.opportunity_id for share;
    if not private.opportunity_accepts_contact(new.opportunity_id, new.contact_id) then
      raise exception 'Activity contact must be the opportunity party or a designated contact point' using errcode = '23514';
    end if;
  end if;
  if new.meeting_id is not null then
    select m.contact_id, m.opportunity_id into meeting_contact, meeting_opportunity
      from public.meetings m where m.id = new.meeting_id for share;
    if new.opportunity_id is not null and meeting_opportunity is not null and new.opportunity_id <> meeting_opportunity then
      raise exception 'Activity and meeting cannot reference different opportunities' using errcode = '23514';
    end if;
    effective_opportunity := coalesce(new.opportunity_id, meeting_opportunity);
    if effective_opportunity is not null then
      perform 1 from public.opportunities where id = effective_opportunity for share;
      if not private.opportunity_accepts_contact(effective_opportunity, new.contact_id)
        or not private.opportunity_accepts_contact(effective_opportunity, meeting_contact) then
        raise exception 'Activity and meeting contacts must belong to their linked opportunity' using errcode = '23514';
      end if;
    elsif new.contact_id is not null and new.contact_id is distinct from meeting_contact then
      raise exception 'Activity contact must match its contact-only meeting' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create function private.validate_contribution()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare source_opportunity public.opportunities%rowtype;
begin
  if tg_op <> 'INSERT' then
    raise exception 'Recognized contributions are append-only; correction workflow is not implemented' using errcode = '23514';
  end if;
  perform private.require_active_pse(new.employee_id);
  select * into source_opportunity from public.opportunities where id = new.opportunity_id for share;
  if new.currency is distinct from source_opportunity.currency
    or new.contribution_type is distinct from source_opportunity.contribution_type then
    raise exception 'Contribution currency and type must match the opportunity; no implicit conversion' using errcode = '23514';
  end if;
  if new.target_vertical_id is not null and not exists (
    select 1 from public.target_verticals where id = new.target_vertical_id and active
  ) then
    raise exception 'Select an active target vertical' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function private.guard_target_plan()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare quarter_count integer; quarter_total numeric; invalid_allocations boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'Target plan deletion is not supported' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    if new.status <> 'draft' or new.approved_by is not null or new.approved_at is not null then
      raise exception 'Create a draft plan before approval' using errcode = '23514';
    end if;
    return new;
  end if;
  if old.status = 'approved' then
    raise exception 'Approved target plans are immutable' using errcode = '23514';
  end if;
  if new.status = 'approved' then
    if not private.is_target_manager() then
      raise exception 'Only an authorized PSE manager can approve targets' using errcode = '42501';
    end if;
    select count(*), coalesce(sum(amount), 0) into quarter_count, quarter_total
      from public.target_quarters where plan_id = old.id;
    if quarter_count <> 4 or quarter_total <> new.annual_amount then
      raise exception 'Exactly four quarterly targets must reconcile to the annual target' using errcode = '23514';
    end if;
    select exists (
      select 1 from public.target_quarters q
      where q.plan_id = old.id and q.amount <> coalesce((
        select sum(a.amount) from public.target_allocations a where a.plan_id = q.plan_id and a.quarter = q.quarter
      ), 0)
    ) into invalid_allocations;
    if invalid_allocations then
      raise exception 'Employee/vertical allocations must reconcile to every quarterly target' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.target_allocations a
      join public.profiles p on p.id = a.employee_id
      join public.target_verticals v on v.id = a.vertical_id
      where a.plan_id = old.id and (not p.active or p.department <> 'PSE'
        or p.role not in ('pse_member', 'pse_manager', 'admin') or not v.active)
    ) then
      raise exception 'Target allocations require active PSE employees and active verticals' using errcode = '23514';
    end if;
    new.approved_by := auth.uid();
    new.approved_at := now();
  end if;
  return new;
end;
$$;

create function private.guard_target_child()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare parent_id uuid; parent_status text;
begin
  if tg_op = 'UPDATE' and (new.plan_id is distinct from old.plan_id or new.quarter is distinct from old.quarter) then
    raise exception 'Target plan and quarter keys are immutable' using errcode = '23514';
  end if;
  parent_id := case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
  -- Serialize all matrix writes against header approval, including an RLS
  -- snapshot that was taken before another transaction approved the plan.
  select status into parent_status from public.target_plans where id = parent_id for update;
  if parent_status is distinct from 'draft' then
    raise exception 'Only draft target allocations can change' using errcode = '23514';
  end if;
  if tg_table_name = 'target_allocations' and tg_op <> 'DELETE' then
    if tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id then
      perform private.require_active_pse(new.employee_id);
    end if;
    if not exists (select 1 from public.target_verticals where id = new.vertical_id and active) then
      raise exception 'Select an active target vertical' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function public.approve_target_plan(p_plan_id uuid)
returns uuid language plpgsql security definer
set search_path = ''
as $$
declare current_status text;
begin
  if not private.is_target_manager() then
    raise exception 'Only an authorized PSE manager can approve targets' using errcode = '42501';
  end if;
  select status into current_status from public.target_plans where id = p_plan_id for update;
  if current_status is null then raise exception 'Target plan not found' using errcode = 'P0002'; end if;
  if current_status <> 'draft' then raise exception 'Only a draft target plan can be approved' using errcode = '23514'; end if;
  -- The transition trigger also validates direct table updates, so bypassing
  -- this RPC cannot bypass reconciliation or forge approval metadata.
  update public.target_plans set status = 'approved' where id = p_plan_id;
  return p_plan_id;
end;
$$;

create function private.record_audit()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare row_before jsonb; row_after jsonb; record_id uuid;
begin
  if tg_op <> 'INSERT' then row_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then row_after := to_jsonb(new); end if;
  record_id := coalesce(row_after->>'id', row_before->>'id', row_after->>'plan_id', row_before->>'plan_id')::uuid;
  insert into public.audit_logs(actor_id, entity, entity_id, action, before, after)
    values (auth.uid(), tg_table_name, record_id, lower(tg_op), row_before, row_after);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create function private.reject_audit_change()
returns trigger language plpgsql security definer
set search_path = ''
as $$
begin
  raise exception 'Audit history is immutable' using errcode = '23514';
end;
$$;

revoke all on function private.require_active_pse(uuid), private.preserve_identity_and_timestamps(),
  private.validate_contact_links(), private.validate_opportunity_links(), private.validate_meeting_links(),
  private.opportunity_accepts_contact(uuid, uuid),
  private.validate_activity_links(), private.validate_contribution(), private.guard_target_plan(),
  private.guard_target_child(), private.record_audit(), private.reject_audit_change()
  from public, anon, authenticated;
revoke all on function public.approve_target_plan(uuid) from public, anon, authenticated;
grant execute on function public.approve_target_plan(uuid) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'contacts', 'pipeline_stages', 'contribution_categories', 'target_verticals',
    'opportunities', 'meetings', 'activities', 'recognized_contributions',
    'target_plans', 'target_quarters', 'target_allocations'
  ] loop
    execute format('create trigger preserve_identity_and_timestamps before insert or update on public.%I for each row execute function private.preserve_identity_and_timestamps()', table_name);
    execute format('create trigger record_audit after insert or update or delete on public.%I for each row execute function private.record_audit()', table_name);
  end loop;
end;
$$;

create trigger validate_contact_links before insert or update on public.contacts
  for each row execute function private.validate_contact_links();
create trigger validate_opportunity_links before insert or update on public.opportunities
  for each row execute function private.validate_opportunity_links();
create trigger validate_meeting_links before insert or update on public.meetings
  for each row execute function private.validate_meeting_links();
create trigger validate_activity_links before insert or update on public.activities
  for each row execute function private.validate_activity_links();
create trigger validate_contribution before insert or update or delete on public.recognized_contributions
  for each row execute function private.validate_contribution();
create trigger guard_target_plan before insert or update or delete on public.target_plans
  for each row execute function private.guard_target_plan();
create trigger guard_target_quarter before insert or update or delete on public.target_quarters
  for each row execute function private.guard_target_child();
create trigger guard_target_allocation before insert or update or delete on public.target_allocations
  for each row execute function private.guard_target_child();
create trigger reject_audit_change before update or delete on public.audit_logs
  for each row execute function private.reject_audit_change();

create index profiles_department_role_idx on public.profiles(department, role) where active;
create index contacts_company_idx on public.contacts(company_id);
create index contacts_created_by_idx on public.contacts(created_by);
create index contacts_name_idx on public.contacts(lower(name));
create index opportunities_contact_idx on public.opportunities(contact_id);
create index opportunities_primary_contact_idx on public.opportunities(primary_contact_id);
create index opportunities_secondary_contact_idx on public.opportunities(secondary_contact_id);
create index opportunities_owner_stage_idx on public.opportunities(owner_id, stage_id);
create index opportunities_stage_idx on public.opportunities(stage_id);
create index opportunities_category_idx on public.opportunities(contribution_category_id);
create index opportunities_created_by_idx on public.opportunities(created_by);
create index opportunities_close_date_idx on public.opportunities(expected_close_at);
create index meetings_contact_idx on public.meetings(contact_id);
create index meetings_opportunity_idx on public.meetings(opportunity_id);
create index meetings_owner_status_date_idx on public.meetings(owner_id, status, scheduled_at);
create index meetings_scheduled_at_idx on public.meetings(scheduled_at);
create index meetings_created_by_idx on public.meetings(created_by);
create index activities_contact_idx on public.activities(contact_id);
create index activities_opportunity_idx on public.activities(opportunity_id);
create index activities_meeting_idx on public.activities(meeting_id);
create index activities_owner_status_date_idx on public.activities(owner_id, status, occurred_at);
create index activities_type_date_idx on public.activities(activity_type, occurred_at);
create index activities_date_idx on public.activities(occurred_at);
create index activities_created_by_idx on public.activities(created_by);
create index contributions_opportunity_idx on public.recognized_contributions(opportunity_id);
create index contributions_employee_date_currency_idx on public.recognized_contributions(employee_id, recognized_at, currency);
create index contributions_vertical_date_currency_idx on public.recognized_contributions(target_vertical_id, recognized_at, currency);
create index contributions_date_currency_idx on public.recognized_contributions(recognized_at, currency);
create index contributions_recorded_by_idx on public.recognized_contributions(recorded_by);
create index target_plans_created_by_idx on public.target_plans(created_by);
create index target_plans_approved_by_idx on public.target_plans(approved_by);
create index target_allocations_employee_idx on public.target_allocations(employee_id, plan_id, quarter);
create index target_allocations_vertical_idx on public.target_allocations(vertical_id, plan_id, quarter);
create index audit_logs_entity_idx on public.audit_logs(entity, entity_id, created_at);
create index audit_logs_actor_idx on public.audit_logs(actor_id, created_at);
