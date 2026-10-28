-- Odoo import (requested 28 October 2026), still awaiting PSE's field mapping. Each imported contact, deal and
-- activity keeps its Odoo external ID, unique per table, so the same export cannot be imported twice. The app
-- imports only files its check found ready, and the whole batch is one transaction: it all lands or none does.
alter table public.contacts
  add column odoo_id text check (odoo_id is null or (btrim(odoo_id) <> '' and length(odoo_id) <= 200));
alter table public.opportunities
  add column odoo_id text check (odoo_id is null or (btrim(odoo_id) <> '' and length(odoo_id) <= 200));
alter table public.activities
  add column odoo_id text check (odoo_id is null or (btrim(odoo_id) <> '' and length(odoo_id) <= 200));
create unique index contacts_odoo_id_key on public.contacts(odoo_id) where odoo_id is not null;
create unique index opportunities_odoo_id_key on public.opportunities(odoo_id) where odoo_id is not null;
create unique index activities_odoo_id_key on public.activities(odoo_id) where odoo_id is not null;

-- Inserts prepared rows with the caller's own rights, so every RLS policy and link trigger applies as for a
-- form. The server generates the IDs and resolves every link before calling. Companies go in before people so
-- people can link to them, then deals, then activities.
create function public.import_odoo(p_contacts jsonb, p_deals jsonb, p_activities jsonb)
returns jsonb
language plpgsql security invoker
set search_path = ''
as $$
declare companies integer; people integer; deals integer; activities integer;
begin
  if not private.is_target_manager() then
    raise exception 'Authorized manager required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_contacts) is distinct from 'array' or jsonb_typeof(p_deals) is distinct from 'array'
    or jsonb_typeof(p_activities) is distinct from 'array'
    or jsonb_array_length(p_contacts) + jsonb_array_length(p_deals) + jsonb_array_length(p_activities) = 0 then
    raise exception 'Nothing to import' using errcode = '22023';
  end if;
  insert into public.contacts(id, kind, name, email, phone, company_id, designation, website, industry, notes, odoo_id, created_by)
    select x.id, x.kind, x.name, x.email, x.phone, x.company_id, x.designation, x.website, x.industry, x.notes, x.odoo_id, auth.uid()
    from jsonb_populate_recordset(null::public.contacts, p_contacts) x where x.kind = 'company';
  get diagnostics companies = row_count;
  insert into public.contacts(id, kind, name, email, phone, company_id, designation, website, industry, notes, odoo_id, created_by)
    select x.id, x.kind, x.name, x.email, x.phone, x.company_id, x.designation, x.website, x.industry, x.notes, x.odoo_id, auth.uid()
    from jsonb_populate_recordset(null::public.contacts, p_contacts) x where x.kind is distinct from 'company';
  get diagnostics people = row_count;
  insert into public.opportunities(id, deal_name, contact_id, primary_contact_id, owner_id, stage_id, contribution_type,
      contribution_category_id, expected_amount, currency, expected_close_at, country, description, valuation_note,
      odoo_id, created_by)
    select x.id, x.deal_name, x.contact_id, x.primary_contact_id, x.owner_id, x.stage_id, x.contribution_type,
      x.contribution_category_id, x.expected_amount, x.currency, x.expected_close_at, x.country, x.description,
      x.valuation_note, x.odoo_id, auth.uid()
    from jsonb_populate_recordset(null::public.opportunities, p_deals) x;
  get diagnostics deals = row_count;
  insert into public.activities(id, activity_type, work_category, status, owner_id, contact_id, opportunity_id,
      related_person_name, related_organization_name, remaining_work, occurred_at, notes, odoo_id, created_by)
    select x.id, x.activity_type, x.work_category, x.status, x.owner_id, x.contact_id, x.opportunity_id,
      x.related_person_name, x.related_organization_name, x.remaining_work, x.occurred_at, x.notes, x.odoo_id, auth.uid()
    from jsonb_populate_recordset(null::public.activities, p_activities) x;
  get diagnostics activities = row_count;
  return jsonb_build_object('contacts', companies + people, 'deals', deals, 'activities', activities);
end;
$$;
revoke all on function public.import_odoo(jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.import_odoo(jsonb, jsonb, jsonb) to authenticated;
