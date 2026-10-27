-- Fictional, deterministic LOCAL demonstration dataset; apply to a fresh database.
-- Prerequisite: scripts/lib/local-database.ts creates isolated Auth fixture identities.
-- No Auth users/passwords are provisioned here. Hosted projects need a reviewed
-- mapping to trusted Auth identities; do not run this seed blindly in production.
begin;

do $$
begin
  if (select count(*) from auth.users where id in (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005'
  )) <> 5 then
    raise exception 'Local demo Auth identities are missing. Use npm run validate:seed; do not provision demo roles from client input.';
  end if;
end $$;

insert into public.profiles (id, display_name, department, role, active) values
('00000000-0000-4000-8000-000000000001', 'Demo Manager', 'PSE', 'pse_manager', true),
('00000000-0000-4000-8000-000000000002', 'Demo Member A', 'PSE', 'pse_member', true),
('00000000-0000-4000-8000-000000000003', 'Demo Member B', 'PSE', 'pse_member', true),
('00000000-0000-4000-8000-000000000004', 'Demo Other Department', 'HR', 'pse_member', true),
('00000000-0000-4000-8000-000000000005', 'Demo Inactive Member', 'PSE', 'pse_member', false);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.pipeline_stages (id, name, position, is_closed, outcome, is_provisional) values
('70000000-0000-4000-8000-000000000001', 'New', 0, false, null, true),
('70000000-0000-4000-8000-000000000002', 'Scoping', 1, false, null, true),
('70000000-0000-4000-8000-000000000003', 'Preparation', 2, false, null, true),
('70000000-0000-4000-8000-000000000004', 'Submitted', 3, false, null, true),
('70000000-0000-4000-8000-000000000005', 'Pending', 4, false, null, true),
('70000000-0000-4000-8000-000000000006', 'Won', 5, true, 'won', true),
('70000000-0000-4000-8000-000000000007', 'Lost', 6, true, 'lost', true),
('70000000-0000-4000-8000-000000000008', 'Abandoned', 7, true, 'abandoned', true);

-- Categories and verticals are independent configurable dimensions. No SAC/VBD mapping is assumed.
insert into public.contribution_categories (id, code, name) values
('80000000-0000-4000-8000-000000000001', 'DSP', 'Digital School Program'),
('80000000-0000-4000-8000-000000000002', 'SAC', 'Sponsor a Child'),
('80000000-0000-4000-8000-000000000003', 'DISASTER', 'Disaster Campaign'),
('80000000-0000-4000-8000-000000000004', 'PROJECT', 'Project'),
('80000000-0000-4000-8000-000000000005', 'EVENT_CAMPAIGN', 'Event and Campaign'),
('80000000-0000-4000-8000-000000000006', 'GENERAL', 'General');

insert into public.target_verticals (id, code, name) values
('50000000-0000-4000-8000-000000000001', 'DSP', 'DSP — provisional'),
('50000000-0000-4000-8000-000000000002', 'VBD', 'VBD — provisional'),
('50000000-0000-4000-8000-000000000003', 'PROJECT', 'Project — provisional');

insert into public.contacts (id, kind, name, email, phone, website, notes) values
('10000000-0000-4000-8000-000000000001', 'company', 'Fictional Example Industries', 'partnerships@example.invalid', '+880 1700 000001', 'https://example.invalid', 'Fictional organization for local testing only.');
insert into public.contacts (id, kind, name, email, phone, company_id, designation) values
('10000000-0000-4000-8000-000000000002', 'individual', 'Fictional Contact One', 'one@example.invalid', '+880 1700 000002', '10000000-0000-4000-8000-000000000001', 'Demo primary contact'),
('10000000-0000-4000-8000-000000000003', 'individual', 'Fictional Contact Two', 'two@example.invalid', '+880 1700 000003', '10000000-0000-4000-8000-000000000001', 'Demo secondary contact'),
('10000000-0000-4000-8000-000000000004', 'individual', 'Fictional Independent Donor', null, '+880 1700 000004', null, null);

insert into public.opportunities (id, deal_name, contact_id, primary_contact_id, secondary_contact_id, owner_id,
 stage_id, contribution_type, contribution_category_id, expected_amount, operational_budget, currency,
 payment_interval, expected_close_at, country, description, valuation_note, valuation_reference_url) values
('20000000-0000-4000-8000-000000000001', 'Fictional school sponsorship', '10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000006', 'cash', '80000000-0000-4000-8000-000000000001', 500000, 12000, 'BDT',
 'quarterly', '2026-03-15', 'Bangladesh', 'Won forecast is not fully received funding.', null, null),
('20000000-0000-4000-8000-000000000002', 'Fictional equipment support', '10000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002', null, '00000000-0000-4000-8000-000000000003',
 '70000000-0000-4000-8000-000000000005', 'valued_in_kind', '80000000-0000-4000-8000-000000000004', 80000, null, 'BDT',
 'once', '2026-06-30', 'Bangladesh', 'Agreed value entered manually; no valuation engine.',
 'Fictional operational-team inventory estimate: 80000 BDT agreed expected value.', 'https://drive.google.com/file/d/fictional-inventory/view'),
('20000000-0000-4000-8000-000000000003', 'Fictional foreign-currency donation', '10000000-0000-4000-8000-000000000004',
 null, null, '00000000-0000-4000-8000-000000000002',
 '70000000-0000-4000-8000-000000000001', 'cash', '80000000-0000-4000-8000-000000000006', 500, null, 'USD',
 'once', '2026-08-01', null, 'Report separately; no invented exchange rate.', null, null);

insert into public.meetings (id, contact_id, opportunity_id, title, scheduled_at, status, owner_id, description) values
('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
 'Fictional sponsorship discussion', '2026-02-01T04:00:00Z', 'done', '00000000-0000-4000-8000-000000000002', 'Local demo meeting.'),
('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', null,
 'Fictional stewardship meeting', '2026-11-05T05:00:00Z', 'scheduled', '00000000-0000-4000-8000-000000000003', 'Contact-only meeting, no financial opportunity required.');

insert into public.activities (id, activity_type, work_category, contact_id, opportunity_id, meeting_id,
 related_person_name, related_organization_name, owner_id, status, remaining_work, occurred_at, notes, estimated_nonmonetary_value) values
('40000000-0000-4000-8000-000000000001', 'email', 'stewardship', '10000000-0000-4000-8000-000000000001',
 '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', null, null,
 '00000000-0000-4000-8000-000000000002', 'done', null, '2026-02-02T04:00:00Z', 'Manually logged email follow-up.', null),
('40000000-0000-4000-8000-000000000002', 'visit', 'independent_general', null, null, null,
 'Fictional Visitor', 'Fictional School', '00000000-0000-4000-8000-000000000003', 'in_progress', 'Send visit notes.',
 '2026-04-05T04:00:00Z', 'Independent visit and small unvalued gift. Recognition estimate is NOT financial achievement.', 5000),
('40000000-0000-4000-8000-000000000003', 'event', 'prospect_engagement', null, null, null,
 null, 'Fictional Community Group', '00000000-0000-4000-8000-000000000002', 'open', 'Confirm participants.',
 '2026-11-10T04:00:00Z', 'Engagement only; no expected financial value.', null);

insert into public.recognized_contributions (id, opportunity_id, employee_id, target_vertical_id, amount, currency,
 recognized_at, contribution_type, approved_value_note, valuation_reference_url) values
('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
 '50000000-0000-4000-8000-000000000001', 165000, 'BDT', '2026-03-20T04:00:00Z', 'cash', null, null),
('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
 '50000000-0000-4000-8000-000000000003', 40000, 'BDT', '2026-05-20T04:00:00Z', 'valued_in_kind',
 'Fictional operational team confirmed received equipment at an agreed 40000 BDT.', 'https://drive.google.com/file/d/fictional-received-inventory/view'),
('90000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002',
 null, 200, 'USD', '2026-07-20T04:00:00Z', 'cash', null, null);

insert into public.target_plans (id, year, currency, annual_amount) values
('60000000-0000-4000-8000-000000000001', 2026, 'BDT', 1000000),
('60000000-0000-4000-8000-000000000002', 2027, 'BDT', 1000000);

insert into public.target_quarters (plan_id, quarter, amount) values
('60000000-0000-4000-8000-000000000001', 1, 150000),
('60000000-0000-4000-8000-000000000001', 2, 250000),
('60000000-0000-4000-8000-000000000001', 3, 250000),
('60000000-0000-4000-8000-000000000001', 4, 350000);

-- Each quarter: Member A/DSP 50%, Member B/VBD 20%, Member B/Project 30%.
-- Amounts are canonical; the target form shows each member's amount and vertical percentages derived from them.
insert into public.target_allocations (plan_id, quarter, employee_id, vertical_id, amount)
select q.plan_id, q.quarter, dimensions.employee_id::uuid, dimensions.vertical_id::uuid, q.amount * dimensions.share
from public.target_quarters q cross join (values
('00000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 0.50),
('00000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 0.20),
('00000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 0.30)
) as dimensions(employee_id, vertical_id, share)
where q.plan_id = '60000000-0000-4000-8000-000000000001';

select public.approve_target_plan('60000000-0000-4000-8000-000000000001');
commit;
