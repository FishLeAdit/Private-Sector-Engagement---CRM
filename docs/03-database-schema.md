# Database schema

The SQL migrations implement the database foundation. They are designed for Supabase PostgreSQL and verified through the repository's isolated local PostgreSQL workflow; hosted application and Auth integration remain separate work. The model is an implementation proposal for the confirmed assessment requirements, with configurable terminology where PSE decisions are pending.

## Migration responsibilities

| Migration | Responsibility |
|---|---|
| [0001_core_schema.sql](../supabase/migrations/0001_core_schema.sql) | Tables, foreign keys, financial and communication constraints, normalized identifiers and URL validation |
| [0002_security_policies.sql](../supabase/migrations/0002_security_policies.sql) | Active-PSE access helpers, table grants and RLS policies |
| [0003_indexes_and_triggers.sql](../supabase/migrations/0003_indexes_and_triggers.sql) | Relationship validation, timestamps, audit history, target reconciliation/locking and query indexes |
| [0004_contact_deletion.sql](../supabase/migrations/0004_contact_deletion.sql) | Creator/manager contact DELETE grant and RLS policy; keeps restrictive foreign keys and audit history |

Apply migrations in filename order. On Supabase, the Auth schema and application database roles are supplied by the platform. Local verification creates an isolated substitute for those dependencies; do not install the test Auth bootstrap into a hosted project.

## Tables and ownership

| Table | Purpose and key relationships |
|---|---|
| `profiles` | Trusted CRM membership, department, role and active status; `id` references `auth.users.id` |
| `contacts` | Individual/company identity, email/phone, optional company link, designation, website, industry and relationship notes; creator references a profile |
| `pipeline_stages` | Configurable ordered stages, closed/outcome flags and provisional status |
| `contribution_categories` | Configurable contribution categories, distinct from target verticals |
| `target_verticals` | Configurable target dimensions; no automatic VBD/SAC equivalence |
| `opportunities` | Expected financial value, owner, stage, contribution category/type, currency, optional budget and valuation context; linked to an individual/company contact and optional points of contact |
| `meetings` | Scheduled/done/cancelled meeting linked to at least a contact or opportunity, with owner, date/time and description |
| `activities` | Work type/category, owner/creator, status, remaining work, relevant date/time and context; contact/opportunity/meeting links are all nullable |
| `recognized_contributions` | Append-only realized amount, currency, recognition date, employee attribution and optional target vertical; linked to an opportunity |
| `target_plans` | One PSE annual plan per year/currency, annual amount, draft/approved state and approval identity/time |
| `target_quarters` | Four independently stored quarter baselines, keyed by `(plan_id, quarter)` |
| `target_allocations` | One amount per `(plan_id, quarter, employee_id, vertical_id)`, referencing the stored quarter |
| `audit_logs` | Actor, entity, action and before/after JSON snapshots; written by database triggers |

Operational records use UUID identities and UTC `timestamptz` audit fields. Foreign keys restrict deletion of referenced records. Client access is narrower than referential integrity alone; see [API and permissions](04-api-and-permissions.md).

Contact deletion is allowed only for an active PSE creator or authorized manager/admin after migration 0004. An individual referenced as an opportunity party/primary/secondary contact, meeting/activity contact, or company associated with people cannot be removed until those references are reassigned or unlinked. No related data cascades. The existing audit trigger records the delete actor and full before snapshot, so deleting a contact is not an erasure of its audit history. No new columns, public functions or generated type changes were needed. The hosted migration is applied separately with `npx supabase db push`.

## Contacts and related records

An individual may exist without a company. A company association must point to a company record rather than another individual or the same contact. Company opportunity points of contact reference individual contact records so names and communication methods remain structured and searchable. A primary point of contact is required for a company opportunity; a secondary point remains representable without enforcing unresolved secondary-contact requiredness.

At least one normalized email or phone must be present. Email comparison trims whitespace and ignores case. Phone comparison removes non-digit characters; it does not infer a country code or equate local and international forms. Use a consistent international format during entry/import and review ambiguous matches. Unique normalized identifiers prevent duplicate records when either value matches; contact forms, including New Deal's inline form, show duplicate warnings/conflicts without automatic merging.

An opportunity's party, company points of contact, meeting and activity links are checked for compatible relationships. An activity may still exist with no CRM links, keeping `related_person_name`, `related_organization_name` and `remaining_work`. Free-text names provide context, not reliable unique identities for a contacts-engaged KPI. No such KPI query is implemented in this checkpoint.

## Financial values and recognition

Amounts use `numeric(14,2)` with finite-value checks. Expected opportunity amounts, actual contribution amounts and annual targets are positive; allocation amounts and an optional operational budget are non-negative. Currency is stored as a three-letter uppercase code. PostgreSQL decimal arithmetic performs reconciliation; future application inputs must handle rounding explicitly.

The Opportunities application uses these existing tables and requires no additional migration. Input rejects more than two decimal places or more than 12 whole digits, rather than silently rounding entered amounts. Stage/category activation is required on creation or selection changes; unchanged inactive historical references can still be edited. Only a manager can reassign a focal person. Configurable stage labels, positions, closed outcomes and provisional flags are maintained through Settings; target verticals remain separate.

`operational_budget` is optional and uses the opportunity currency in this implementation. It is separate from `expected_amount` and must never be added to expected fundraising or realized achievement. There is no currency conversion rule; reports must group by currency.

`cash` and `valued_in_kind` are proposed internal financial types. For valued in-kind opportunities, `valuation_note` records the agreed estimate context. Recognized in-kind contributions retain their own `approved_value_note` and optional `valuation_reference_url`; both opportunity and contribution references accept HTTP(S) links. The operational team supplies the inventory/market estimate and PSE enters the agreed amount manually. Notes and URLs preserve evidence; no upload or valuation engine is included.

Expected value and realized support remain separate records. Winning a deal or editing its value does not insert a contribution. Contributions carry explicit `employee_id` and optional `target_vertical_id`, so later opportunity ownership changes do not silently reassign historical achievement. An absent vertical remains unassigned rather than being inferred from a contribution category. Refunds/corrections are not implemented; application clients cannot edit or delete recognized contributions.

## Target reconciliation and locking

An annual plan stores its own baseline, each quarter stores its baseline, and the employee × quarter × vertical grid stores allocation amounts once. Percentage inputs are intended for a later service/form; monetary amounts are canonical, and no second independently editable percentage total is stored.

Draft plans may be incomplete. Approval through `approve_target_plan` checks all of the following in one transaction:

1. The caller is an active, authorized PSE manager.
2. Exactly Q1–Q4 exist and their amounts sum to the annual target.
3. Each quarter's employee/vertical allocation amounts sum to that quarter's baseline.
4. Allocated employees are valid active PSE personnel.

Approval and child-allocation edits lock the same parent plan row to prevent concurrent edits from bypassing reconciliation. Once approved, the plan header, quarter baselines and grid cannot be edited or deleted through normal application operations. The approved identity/time and before/after audit history are retained. Overachievement changes report results only; it never reduces another quarter's target.

## Configuration and remaining integration

Seed stage/category/vertical labels are provisional demonstration configuration, not finalized PSE terminology. Updating configuration is restricted to authorized managers. Contacts' active/inactive lifecycle, final category-to-vertical mappings, refund handling and reporting formulas still need decisions.

The seed is local demonstration data using fixed fictional profile IDs. Matching Auth identity rows are supplied by the isolated test bootstrap, not by the migrations or seed. There are no Auth passwords or real demo login accounts. A hosted import requires trusted identity provisioning and reviewed ID mappings; this checkpoint does not deploy to a hosted project.

Database types are generated from the migrated local catalog by the repository workflow. Auth and Contacts services/forms use this existing schema; no Contacts migration was needed. Contact creators are displayed as owners, and type/creator fields remain immutable. Hosted sign-in/CRUD checks remain manual. See [verification evidence](07-testing-and-limitations.md) for commands actually run and [entity relationships](diagrams/entity-relationships.mmd) for the editable diagram.
