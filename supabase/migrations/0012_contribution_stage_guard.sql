-- New receipts are accepted only while their opportunity is open or won (decided 28 October 2026).
-- Receipts recorded earlier stay valid if the deal later closes: that money was received, so moving a deal
-- to Lost/Abandoned/Junk is not blocked. Otherwise identical to the 0003 definition; the trigger and
-- function privileges are kept by create or replace.
create or replace function private.validate_contribution()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare source_opportunity public.opportunities%rowtype; source_stage public.pipeline_stages%rowtype;
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
