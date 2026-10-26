-- Identity is supplied by Supabase Auth. Profiles are provisioned only by a
-- trusted administrator; clients cannot promote themselves or change department.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_pse_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.department = 'PSE'
      and p.role in ('pse_member', 'pse_manager', 'admin')
  );
$$;

create function private.is_target_manager()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active and p.department = 'PSE'
      and p.role in ('pse_manager', 'admin')
  );
$$;

revoke all on function private.is_pse_member() from public, anon, authenticated;
revoke all on function private.is_target_manager() from public, anon, authenticated;
grant execute on function private.is_pse_member(), private.is_target_manager() to authenticated;
revoke all on function public.valid_http_url(text), public.valid_http_urls(text[]) from public, anon, authenticated;
grant execute on function public.valid_http_url(text), public.valid_http_urls(text[]) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles', 'contacts', 'pipeline_stages', 'contribution_categories',
    'target_verticals', 'opportunities', 'meetings', 'activities',
    'recognized_contributions', 'target_plans', 'target_quarters',
    'target_allocations', 'audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from public, anon, authenticated', table_name);
    execute format('grant select on table public.%I to authenticated', table_name);
    if table_name = 'profiles' then
      execute 'create policy team_read on public.profiles for select to authenticated using ((select private.is_pse_member()) and department = ''PSE'')';
    elsif table_name = 'audit_logs' then
      execute 'create policy team_read on public.audit_logs for select to authenticated using ((select private.is_pse_member()) and (entity <> ''profiles'' or before->>''department'' = ''PSE'' or after->>''department'' = ''PSE''))';
    else
      execute format('create policy team_read on public.%I for select to authenticated using ((select private.is_pse_member()))', table_name);
    end if;
  end loop;
end;
$$;

grant insert, update on public.contacts, public.opportunities, public.meetings, public.activities to authenticated;
grant insert on public.recognized_contributions to authenticated;
grant insert, update on public.pipeline_stages, public.contribution_categories, public.target_verticals,
  public.target_plans, public.target_quarters, public.target_allocations to authenticated;

create policy member_insert on public.contacts for insert to authenticated
with check ((select private.is_pse_member()) and created_by = (select auth.uid()));
create policy owner_update on public.contacts for update to authenticated
using ((select private.is_pse_member()) and (created_by = (select auth.uid()) or (select private.is_target_manager())))
with check ((select private.is_pse_member()) and (created_by = (select auth.uid()) or (select private.is_target_manager())));

do $$
declare table_name text;
begin
  foreach table_name in array array['opportunities', 'meetings', 'activities'] loop
    execute format(
      'create policy member_insert on public.%I for insert to authenticated with check ((select private.is_pse_member()) and created_by = (select auth.uid()) and (owner_id = (select auth.uid()) or (select private.is_target_manager())))',
      table_name
    );
    execute format(
      'create policy owner_update on public.%I for update to authenticated using ((select private.is_pse_member()) and (owner_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_target_manager()))) with check ((select private.is_pse_member()) and (owner_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_target_manager())))',
      table_name
    );
  end loop;

  foreach table_name in array array['pipeline_stages', 'contribution_categories', 'target_verticals'] loop
    execute format('create policy manager_insert on public.%I for insert to authenticated with check ((select private.is_target_manager()))', table_name);
    execute format('create policy manager_update on public.%I for update to authenticated using ((select private.is_target_manager())) with check ((select private.is_target_manager()))', table_name);
  end loop;
end;
$$;

create policy member_insert on public.recognized_contributions for insert to authenticated
with check ((select private.is_pse_member()) and recorded_by = (select auth.uid()));

create policy manager_insert on public.target_plans for insert to authenticated
with check ((select private.is_target_manager()) and created_by = (select auth.uid()) and status = 'draft');
create policy manager_update on public.target_plans for update to authenticated
using ((select private.is_target_manager()) and status = 'draft')
with check ((select private.is_target_manager()));

do $$
declare table_name text;
begin
  foreach table_name in array array['target_quarters', 'target_allocations'] loop
    execute format(
      'create policy manager_insert on public.%I for insert to authenticated with check ((select private.is_target_manager()) and exists (select 1 from public.target_plans p where p.id = plan_id and p.status = ''draft''))', table_name
    );
    execute format(
      'create policy manager_update on public.%I for update to authenticated using ((select private.is_target_manager()) and exists (select 1 from public.target_plans p where p.id = plan_id and p.status = ''draft'')) with check ((select private.is_target_manager()) and exists (select 1 from public.target_plans p where p.id = plan_id and p.status = ''draft''))', table_name
    );
  end loop;
end;
$$;

-- There are deliberately no app grants/policies for profile mutations,
-- contribution corrections, deletions, or direct audit insertion.
