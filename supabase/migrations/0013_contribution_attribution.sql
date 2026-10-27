-- Members credit receipts to themselves; an authorized manager may credit any active PSE employee
-- (decided 28 October 2026). Replaces the 0002 policy, which let any member credit anyone.
drop policy member_insert on public.recognized_contributions;
create policy member_insert on public.recognized_contributions for insert to authenticated
with check (
  (select private.is_pse_member()) and recorded_by = (select auth.uid())
  and (employee_id = (select auth.uid()) or (select private.is_target_manager()))
);
