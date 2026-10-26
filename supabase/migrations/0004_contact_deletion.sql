-- User-requested contact deletion. Existing FK RESTRICT constraints preserve
-- linked contacts/opportunities/meetings/activities; no related rows cascade.
-- The existing audit trigger retains the deleted contact snapshot and actor.
grant delete on public.contacts to authenticated;

create policy owner_delete on public.contacts
for delete to authenticated
using (
  (select private.is_pse_member())
  and (created_by = (select auth.uid()) or (select private.is_target_manager()))
);
