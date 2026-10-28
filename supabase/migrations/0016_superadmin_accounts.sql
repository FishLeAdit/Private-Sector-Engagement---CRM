-- Superadmin (requested 28 October 2026). The existing `admin` role becomes the superadmin: everything a manager
-- can do, plus managing accounts and deleting draft target plans. Sign-in identities (email and password) are
-- created and removed by the app's server with the Supabase service role; every profile change goes through
-- the functions below, which require an active superadmin caller. Financial history stays protected:
-- contributions are still corrected rather than deleted, and approved plans stay locked.

create function private.is_superadmin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.department = 'PSE' and p.role = 'admin'
  );
$$;
revoke all on function private.is_superadmin() from public, anon, authenticated;
grant execute on function private.is_superadmin() to authenticated;

-- A superadmin also sees other departments' profiles, such as restricted accounts.
create policy superadmin_read on public.profiles for select to authenticated using ((select private.is_superadmin()));

-- Every sign-in account with its CRM profile, if it has one, as a JSON array. App clients cannot read auth.users.
create function public.admin_list_accounts()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'Superadmin required' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', u.id, 'email', u.email, 'display_name', p.display_name, 'department', p.department, 'role', p.role,
      'active', p.active, 'last_sign_in_at', u.last_sign_in_at
    ) order by p.display_name is null, lower(coalesce(p.display_name, u.email::text)), u.id)
    from auth.users u left join public.profiles p on p.id = u.id
  ), '[]'::jsonb);
end;
$$;

-- Creates the profile for an existing sign-in account, or changes one. A superadmin cannot remove their own
-- superadmin access, so at least one active superadmin always remains.
create function public.admin_save_profile(p_id uuid, p_display_name text, p_department text, p_role text, p_active boolean)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare existing public.profiles%rowtype;
begin
  if not private.is_superadmin() then
    raise exception 'Superadmin required' using errcode = '42501';
  end if;
  if p_id = auth.uid() and (p_role is distinct from 'admin' or p_active is distinct from true
    or btrim(coalesce(p_department, '')) is distinct from 'PSE') then
    raise exception 'You cannot remove your own superadmin access' using errcode = '23514';
  end if;
  select * into existing from public.profiles where id = p_id for update;
  if existing.id is null then
    if not exists (select 1 from auth.users where id = p_id) then
      raise exception 'Sign-in account not found' using errcode = 'P0002';
    end if;
    insert into public.profiles(id, display_name, department, role, active)
      values (p_id, btrim(p_display_name), btrim(p_department), p_role, coalesce(p_active, true));
  else
    update public.profiles
      set display_name = btrim(p_display_name), department = btrim(p_department), role = p_role, active = coalesce(p_active, true)
      where id = p_id;
  end if;
  return p_id;
end;
$$;

-- Deletes a profile that nothing references. Anyone with history (records, audit entries) is restricted instead.
create function public.admin_delete_profile(p_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_superadmin() then
    raise exception 'Superadmin required' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'You cannot delete your own account' using errcode = '23514';
  end if;
  delete from public.profiles where id = p_id;
  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;
  return p_id;
end;
$$;

-- The 0003 plan guard, now letting a superadmin delete a draft. Everything else is unchanged.
create or replace function private.guard_target_plan()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare quarter_count integer; quarter_total numeric; invalid_allocations boolean;
begin
  if tg_op = 'DELETE' then
    if old.status = 'draft' and private.is_superadmin() then
      return old;
    end if;
    raise exception 'Only a superadmin can delete a draft target plan' using errcode = '23514';
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

-- Deletes a draft target plan with its quarters and allocation cells. Approved plans stay locked.
create function public.admin_delete_target_draft(p_plan_id uuid)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare plan public.target_plans%rowtype;
begin
  if not private.is_superadmin() then
    raise exception 'Superadmin required' using errcode = '42501';
  end if;
  select * into plan from public.target_plans where id = p_plan_id for update;
  if plan.id is null then
    raise exception 'Target not found' using errcode = 'P0002';
  end if;
  if plan.status <> 'draft' then
    raise exception 'Approved targets are fixed' using errcode = '23514';
  end if;
  delete from public.target_allocations where plan_id = p_plan_id;
  delete from public.target_quarters where plan_id = p_plan_id;
  delete from public.target_plans where id = p_plan_id;
  return p_plan_id;
end;
$$;

revoke all on function public.admin_list_accounts(), public.admin_save_profile(uuid, text, text, text, boolean),
  public.admin_delete_profile(uuid), public.admin_delete_target_draft(uuid) from public, anon, authenticated;
grant execute on function public.admin_list_accounts(), public.admin_save_profile(uuid, text, text, text, boolean),
  public.admin_delete_profile(uuid), public.admin_delete_target_draft(uuid) to authenticated;
