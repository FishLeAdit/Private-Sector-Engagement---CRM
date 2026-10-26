-- User-requested addition; same ownership predicate as meeting editing.
-- Activity/follow-up FKs restrict deletion; audit snapshots and parent records remain.
grant delete on public.meetings to authenticated;
create policy owner_delete on public.meetings
for delete to authenticated
using (
  (select private.is_pse_member())
  and (owner_id = (select auth.uid()) or created_by = (select auth.uid()) or (select private.is_target_manager()))
);
