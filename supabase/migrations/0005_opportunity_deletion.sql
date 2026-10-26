-- User-requested opportunity deletion, matching existing edit permissions.
-- FK RESTRICT protects meetings, activities and recognized contributions.
-- Existing audit triggers retain the deleted snapshot and request actor.
grant delete on public.opportunities to authenticated;

create policy owner_delete on public.opportunities
for delete to authenticated
using (
  (select private.is_pse_member())
  and (
    owner_id = (select auth.uid())
    or created_by = (select auth.uid())
    or (select private.is_target_manager())
  )
);
