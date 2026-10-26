-- Explicit user-requested activity deletion; preserve parent records and audit snapshots.
grant delete on public.activities to authenticated;
create policy owner_delete on public.activities
for delete to authenticated
using ((select private.is_pse_member()) and (owner_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_target_manager())));
