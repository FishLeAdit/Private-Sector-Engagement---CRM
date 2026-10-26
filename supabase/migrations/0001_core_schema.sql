-- PSE CRM foundation. Supabase supplies auth.users and auth.uid().
-- Lookup contents remain configurable; no pipeline/vertical terminology is final.

create function public.valid_http_url(value text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select value is null or value ~* '^https?://[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]<>"]*)?$';
$$;

create function public.valid_http_urls(values_to_check text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select values_to_check is not null
    and not exists (
      select 1 from unnest(values_to_check) as item(url)
      where item.url is null or not public.valid_http_url(item.url)
    );
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  display_name text not null check (btrim(display_name) <> ''),
  department text not null default 'PSE' check (btrim(department) <> ''),
  role text not null default 'pse_member' check (role in ('pse_member', 'pse_manager', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('individual', 'company')),
  name text not null check (btrim(name) <> ''),
  email text,
  phone text,
  email_normalized text generated always as (nullif(lower(btrim(email)), '')) stored,
  -- Store an explicit country code consistently. Formatting is stripped, but
  -- local-number country codes, leading-zero rules and extensions are not inferred.
  phone_normalized text generated always as (nullif(regexp_replace(phone, '[^0-9]', '', 'g'), '')) stored,
  company_id uuid references public.contacts(id) on delete restrict,
  designation text,
  website text check (public.valid_http_url(website)),
  industry text,
  notes text,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_communication_required check (email_normalized is not null or phone_normalized is not null),
  constraint contacts_company_not_self check (company_id is null or company_id <> id),
  constraint contacts_company_link_individual_only check (kind = 'individual' or company_id is null),
  constraint contacts_email_unique unique (email_normalized),
  constraint contacts_phone_unique unique (phone_normalized)
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> ''),
  position integer not null unique check (position >= 0),
  is_closed boolean not null default false,
  outcome text check (outcome in ('won', 'lost', 'abandoned', 'junk')),
  is_provisional boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipeline_stages_outcome_state check (
    (is_closed and outcome is not null) or (not is_closed and outcome is null)
  )
);

create table public.contribution_categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  is_provisional boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.target_verticals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z][A-Z0-9_]*$'),
  name text not null check (btrim(name) <> ''),
  active boolean not null default true,
  is_provisional boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  deal_name text not null check (btrim(deal_name) <> ''),
  contact_id uuid not null references public.contacts(id) on delete restrict,
  primary_contact_id uuid references public.contacts(id) on delete restrict,
  secondary_contact_id uuid references public.contacts(id) on delete restrict,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  stage_id uuid not null references public.pipeline_stages(id) on delete restrict,
  contribution_type text not null check (contribution_type in ('cash', 'valued_in_kind')),
  contribution_category_id uuid not null references public.contribution_categories(id) on delete restrict,
  expected_amount numeric(14,2) not null check (expected_amount > 0 and expected_amount <= 999999999999.99),
  operational_budget numeric(14,2) check (operational_budget >= 0 and operational_budget <= 999999999999.99),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  payment_interval text,
  expected_close_at date,
  country text,
  description text,
  notes text,
  drive_urls text[] not null default '{}' check (public.valid_http_urls(drive_urls)),
  valuation_note text,
  valuation_reference_url text check (public.valid_http_url(valuation_reference_url)),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint opportunities_distinct_contact_points check (
    primary_contact_id is null or secondary_contact_id is null or primary_contact_id <> secondary_contact_id
  ),
  constraint opportunities_in_kind_valuation_required check (
    contribution_type <> 'valued_in_kind' or nullif(btrim(valuation_note), '') is not null
  )
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete restrict,
  opportunity_id uuid references public.opportunities(id) on delete restrict,
  title text not null check (btrim(title) <> ''),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'done', 'cancelled')),
  description text,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_link_required check (contact_id is not null or opportunity_id is not null)
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_type text not null check (activity_type in (
    'task', 'email', 'call', 'meeting', 'event', 'campaign', 'proposal',
    'visit', 'stewardship', 'prospect_engagement', 'general'
  )),
  work_category text not null default 'independent_general'
    check (work_category in ('stewardship', 'prospect_engagement', 'independent_general')),
  contact_id uuid references public.contacts(id) on delete restrict,
  opportunity_id uuid references public.opportunities(id) on delete restrict,
  meeting_id uuid references public.meetings(id) on delete restrict,
  related_person_name text,
  related_organization_name text,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  remaining_work text,
  occurred_at timestamptz,
  notes text,
  drive_urls text[] not null default '{}' check (public.valid_http_urls(drive_urls)),
  estimated_nonmonetary_value numeric(14,2)
    check (estimated_nonmonetary_value >= 0 and estimated_nonmonetary_value <= 999999999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recognized_contributions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete restrict,
  employee_id uuid not null references public.profiles(id) on delete restrict,
  target_vertical_id uuid references public.target_verticals(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0 and amount <= 999999999999.99),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  recognized_at timestamptz not null,
  contribution_type text not null check (contribution_type in ('cash', 'valued_in_kind')),
  approved_value_note text,
  valuation_reference_url text check (public.valid_http_url(valuation_reference_url)),
  notes text,
  recorded_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recognized_contributions_in_kind_valuation_required check (
    contribution_type <> 'valued_in_kind' or nullif(btrim(approved_value_note), '') is not null
  )
);

create table public.target_plans (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 1 and 9999),
  currency text not null default 'BDT' check (currency ~ '^[A-Z]{3}$'),
  annual_amount numeric(14,2) not null check (annual_amount > 0 and annual_amount <= 999999999999.99),
  status text not null default 'draft' check (status in ('draft', 'approved')),
  created_by uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  approved_by uuid references public.profiles(id) on delete restrict,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_plans_year_currency_unique unique (year, currency),
  constraint target_plans_approval_metadata check (
    (status = 'draft' and approved_by is null and approved_at is null)
    or (status = 'approved' and approved_by is not null and approved_at is not null)
  )
);

create table public.target_quarters (
  plan_id uuid not null references public.target_plans(id) on delete restrict,
  quarter smallint not null check (quarter between 1 and 4),
  amount numeric(14,2) not null check (amount >= 0 and amount <= 999999999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, quarter)
);

create table public.target_allocations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  quarter smallint not null check (quarter between 1 and 4),
  employee_id uuid not null references public.profiles(id) on delete restrict,
  vertical_id uuid not null references public.target_verticals(id) on delete restrict,
  amount numeric(14,2) not null check (amount >= 0 and amount <= 999999999999.99),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint target_allocations_quarter_fkey foreign key (plan_id, quarter)
    references public.target_quarters(plan_id, quarter) on delete restrict,
  constraint target_allocations_dimension_unique unique (plan_id, quarter, employee_id, vertical_id)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete restrict,
  entity text not null check (btrim(entity) <> ''),
  entity_id uuid not null,
  action text not null check (btrim(action) <> ''),
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);
