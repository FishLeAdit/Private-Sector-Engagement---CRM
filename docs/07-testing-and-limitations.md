# Testing and limitations

The database foundation, authentication, Contacts, financial Opportunities, Meetings with linked follow-up tasks, and the full Activities workspace are implemented. Other CRM modules remain scaffolds. Evidence below distinguishes PostgreSQL/service tests, mocked transports/form tests, anonymous browser checks and hosted verification that remains manual.

## Activities, deletion, hosted seed and assessment review on 27 October 2026

| Check | Result |
|---|---|
| `npm test` | 418 passed across 32 files; 74 new Activities checks |
| `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts activities.spec.ts` | Twelve anonymous Chromium checks passed; three optional live cases skipped |
| `npm run lint`, `npm run typecheck`, `npm run build` | Passed; list/new/detail/edit and Activities API routes compile |
| `npm run validate:seed`, `npm run db:types:check` | Passed; seven migrations and unchanged 13-table types |
| Linked Supabase migration | Dry run identified only 0007; activity deletion grant/RLS applied successfully |
| `npm.cmd run seed:activities -- --apply` | Inserted/verified 11 hosted activities, all 11 required types, including four independent entries |

Local SQL tests verify owner/creator/manager deletion, denied unrelated/inactive/non-PSE/anonymous mutations, retained audit snapshots and parents, compatible direct and meeting-derived links, immutable identity, and deletion that can unblock parent meeting deletion. Creation, completion, deletion and demo insertion/reruns leave recognized contributions, opportunity values and target allocations unchanged. Legacy non-monetary estimates remain untouched by status/detail writes.

API tests exercise the real shared service through mocked repositories: all 11 independent types, optional links/free context, partial-update preservation, verified creator, manager-only owner assignment, inactive historical ownership, unavailable references, same-origin/content/size/strict-field validation, safe failures and zero-row writes. SDK contracts inspect real Supabase-generated filters/joins, literal search, direct-context filters, Dhaka date boundaries, deterministic pagination, audit/owner bounds and scoped deletes. DOM tests cover independent creation, UTC conversion, lookup-in-progress submission protection, preserved drafts, status changes and confirmation/cancel/error/duplicate-delete/Escape behavior. Native dialog focus and keyboard interaction still need manual browser testing; jsdom substitutes dialog methods.

The configured hosted project matched the app before migration. The administrative seed inserted only missing stable activity IDs for the existing Demo Manager and verified real PostgREST relationships. It did not provision users or alter parents, forecasts, targets or actual contributions. A subsequent read-only preview found all 11 entries and zero missing inserts. No hosted record was deleted as a test. End-user JWT/RLS, authenticated browser persistence and interactive mutation acceptance remain manual, as requested; anonymous tests reused the existing port-3000 server and left it running.

The assessment mapping is in [requirements](01-requirements-and-assumptions.md#activities-assessment-check). Work-category/status keys, required descriptive notes, optional time, ownership permissions and user-requested deletion are documented project choices. All CRM links can be absent; unlinked text is not automatically a contact identity. Events and Meeting-type work logs do not create separate calendar/financial records. No Gmail sync, direct uploads, external autofill, automatic valuations, financial recognition or unapproved KPI was added. Relevant-time filters exclude undated entries; lists show 20 rows and audit history 20 entries. Full reporting, target/contribution-entry UI and deployment remain pending. Earlier sections below record historical checkpoint results and limitations at the time.

## Meeting deletion, hosted examples and assessment review on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 344 passed across 28 files; 33 additional meeting deletion/seed checks |
| Combined sign-in/Contacts/Opportunities/Meetings E2E | Ten anonymous Chromium checks passed, including blocked anonymous meeting DELETE; three live cases skipped |
| Lint / TypeScript / production build | Passed |
| `validate:seed` / `db:types:check` | Passed with all six migrations; types still match all 13 tables |
| Linked Supabase migration dry run, then push | Confirmed only 0006 pending and applied it; no records deleted by migration |
| `npm.cmd run seed:meetings -- --apply`, then preview | Inserted/verified six meetings for Demo Manager (Scheduled 3, Done 2, Cancelled 1); repeat preview found zero missing inserts |

SQL tests verify deletion by owner/creator/manager, denial for unrelated/non-PSE/inactive/anonymous callers, revoked access on own records, retained contacts/opportunities/audit snapshots, blocked activity/follow-up references with no cascades or failed-delete audit, and Done/Cancelled deletion without financial mutation. API/service/SDK tests cover authorization, requested-ID/affected-row handling, matching Origin, no-body DELETE and safe 409 mapping for both reference-conflict codes. DOM tests cover named confirmation, cancellation, successful navigation, conflicts and pending duplicate/cancel/Escape prevention.

The meeting-seed tests validate six deterministic fictional records, status/link/timezone variation, use of current parent contact points, no automatic recreation of deleted parents, PSE visibility, repeat-run preservation of edits, and unchanged financial/activity records. Hosted application used the private administrative connection and preserved existing meetings/parents/financial data. Real PostgREST meeting/contact/opportunity joins were verified. Normal application clients remain caller-scoped under RLS; live login and authenticated browser deletion remain manual. Anonymous browser tests reused and left the existing port-3000 server running. No live end-user opportunity/contact/meeting was deleted as a test.

The Word assessment's original Meetings fields and later relationship/follow-up/visibility/internal-search clarifications were reread and compared with the code. Confirmed behaviors are mapped in [requirements and assumptions](01-requirements-and-assumptions.md#meetings-assessment-check). Title/owner requiredness, optional description, Cancelled, live-linked contact details and detailed edit/delete rules remain project choices; deletion is explicitly user-requested. Named-individual requiredness for company-only meetings remains a PSE clarification. Full Activities editing/reporting and the broader assessment remain pending; this checkpoint is not a claim that the whole CRM assessment is complete.

## Meetings verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 311 passed across 25 files, including 74 additional meeting SQL/service/API/SDK/form/date checks |
| `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts` | Ten anonymous Chromium checks passed; three optional live cases skipped |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed; Meetings list/new/detail/edit and options/follow-up API routes compile |

SQL/RLS tests verify contact-only and opportunity-only persistence, company party/primary/secondary compatibility, mandatory linkage, designation/communication joins, UTC status auditing, team reads, owner/creator/manager edits, manager-only assignment/reassignment, restricted actors, unchanged inactive historical owners and reverse relationship guards when linked follow-ups exist. Follow-up tasks persist as open activities linked to the meeting without changing forecast, target or actual contribution values. Shared-service tests additionally cover identity mismatch, partial-update preservation/clearing, stale selections and nullable inherited context.

API and real-SDK/mock-HTTP tests verify strict payloads, verified creator binding, same-origin/JSON limits, safe errors, filter bounds, stable 20-row pagination, full Dhaka-day ranges and bounded 20-row activity/audit history. Upcoming means scheduled from now; completed means done. Period/status filters intersect and direct-contact filtering does not include opportunity-derived contacts. Form/date tests cover Dhaka-to-UTC round trips across dates, invalid calendar input, derived contact information, preserved drafts/errors, internal opportunity selection, waiting for deal details before submission, status-only completion and follow-up retry after failure.

The combined browser run reused the existing localhost:3000 server and left it running. It verifies anonymous APIs/redirects, including Meetings options/new/detail/edit/follow-ups. Live credentials/writes were disabled, honoring the developer's manual-testing preference. No schema migration, hosted login, hosted meeting/follow-up seed or hosted mutation was performed for this checkpoint. Existing tables/types/RLS already support the workflow. Authenticated hosted PostgREST joins, browser persistence, native keyboard/focus and current-user permissions still require manual acceptance.

At the initial Meetings checkpoint, deletion had not yet been added; the subsequent deletion/seed checkpoint is recorded above. The full Activities workspace, follow-up status editing and standalone work logging remain pending. Required title/owner and optional Cancelled status are existing project choices; organization/designation/communication are internal linked data rather than external autofill or snapshots. Follow-up relevant date/time uses the existing activity timestamp and is not a separate due-date/reminder feature. No Gmail sync, uploads, calendar integration, valuation engine or follow-up KPI was introduced.

## Opportunity deletion verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 237 passed across 19 files, including 31 additional deletion checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts` | Eight anonymous Chromium checks passed, including rejected anonymous opportunity DELETE; three live cases skipped |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed |
| `npm run validate:seed` / `npm run db:types:check` | Passed with all five migrations; generated types still match all 13 tables |
| `npx.cmd supabase db push --dry-run` then `npx.cmd supabase db push --linked --yes` | Confirmed only migration 0005 was pending, then applied it to the same project configured for the app |

Local SQL tests independently verify focal-person, creator and manager deletion; unrelated/non-PSE/inactive/anonymous denial; inactive/non-PSE owners losing access; FK restrictions for meetings, activities and recognized contributions; retained contacts; retained actor/before audit snapshots; no delete audit on a rolled-back FK failure; and deletion of an unlinked Won deal without altering actual achievement. Service tests exercise the same permissions under SQL/RLS. API/SDK tests cover strict requested-ID deletion, affected-row checks, same-origin requests, missing IDs, no-store responses and safe 409 mapping for both `23503` and `23001`.

DOM tests cover named confirmation, cancellation without a request, successful navigation, visible conflicts, disabled duplicate submission/cancellation and blocked Escape dismissal while pending, plus retry after network failure. Native dialog focus behavior remains a manual browser check. Anonymous checks reused the existing port-3000 server and left it running.

The hosted migration adds a DELETE grant/policy only; it deleted no existing opportunities or other records. No hosted opportunity deletion or live login was executed; the developer's preference for manual authenticated browser testing remains in effect. End-user hosted permission/persistence checks remain manual. Deletion is an explicit user-requested addition, with ownership matching the existing edit policy; recognized-contribution correction/deletion remains excluded.

## Hosted demo seeding on 26 October 2026

The separate `scripts/seed-demo.ts` command previews or explicitly inserts 3 fictional companies, 8 individuals and 8 opportunities into the configured project. It requires an existing active PSE owner and a private server-side key, preserves existing rows on repeat runs, checks communication-identifier collisions before writes, and initializes provisional lookups only when their tables are empty. It does not provision users or create received contributions/targets. The administrative transport is separate from the normal caller-scoped application path.

All 206 tests across 17 files passed, including six additional checks for the generated dataset, active configuration/owner selection, collision checks, actual SQL/RLS relationships and rerun preservation of user edits. Typecheck, lint and production build passed. Local tests also verify that this dataset leaves existing profiles, targets and recognized contributions unchanged. The runner rejects placeholder/non-administrative keys before making requests.

After the developer privately configured the key, the hosted preview confirmed 3 companies, 8 individuals and 8 opportunities were missing, with no stage/category setup needed. `npm.cmd run seed:demo -- --apply` inserted them and verified the stored records plus contact/stage/category joins through real PostgREST. They are assigned to the existing Demo Manager. A subsequent read-only preview reported 11 contacts and 8 opportunities already present, with zero inserts needed. No received contributions, target values, Auth accounts or profiles were inserted/changed.

The ordinary `npm` PowerShell invocation consumed the `--apply` flag and only previewed; using `npm.cmd` forwarded it correctly. This verification used administrative access, not an end-user session. Hosted sign-in, interactive browser persistence and end-user RLS/filter acceptance remain manual checks. Earlier checkpoint notes below describe their historical runs before this hosted demo insert.

## Opportunities verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 200 passed across 16 files, including 49 additional opportunity service/SQL, SDK, API and form checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts` | Eight anonymous Chromium checks passed; three live cases skipped |
| `npm run typecheck` / `npm run build` | Passed; list/new/detail/edit, Settings and new API routes compile |
| `npm run lint` / `npm run validate:seed` / `npm run db:types:check` | Passed; seed integrity retained and generated types match all 13 tables |

Shared-service tests use disposable PostgreSQL/RLS to verify individual/company deals, both contact people, optional fields/budgets, partial-update preservation, positive finite decimal values, manual in-kind valuation, owner/creator/manager editing and reassignment, inactive historical selections and empty-project provisional configuration. Stage moves retain before/after audit snapshots and create no recognized contributions. Database tests independently reject unrelated edits, non-manager configuration, incompatible meeting/activity links and changes to recognized-contribution currency/type. The seed/type scripts initially hit the known Windows user-info sandbox error and passed when rerun outside the sandbox.

SDK tests use the real Supabase client with mocked HTTP to check literal search, combined filters, deterministic pagination, FK selections, bounded history, configuration writes and safe error mapping. API tests cover verified creators, no-store responses, same-origin writes, JSON/size checks, strict fields, role denial and safe exceptions. DOM tests check required financial value/valuation, inline contact creation preserving the deal draft and selecting the new contact without navigation or nested forms, error preservation, reference URLs and rejected stage moves. Contact form regression tests still pass after adding callback support.

Anonymous browser checks cover opportunity APIs/configuration and redirects for board/new/detail/edit/Settings. They reused the developer's running port-3000 server, which was left running. Live login and contact-write cases were explicitly disabled in keeping with the developer's manual-testing preference. No hosted login, deal/contact/configuration writes, schema changes or new migrations were performed. Full authenticated hosted persistence, actual PostgREST join/filter behavior and native dialog focus/keyboard behavior remain manual checks; jsdom uses dialog method substitutes.

The original assessment fields are represented, with primary company contact required and secondary optional pending confirmation. Final stages are not hardcoded: manager configuration uses stored IDs/outcomes; optional assessment examples are explicitly provisional. The board and expected-value subtotals cover only the current 20-deal page. Details show recent actuals/audits rather than full totals. Lookups cap at 1,000 entries each. Configuration example setup uses sequential, retryable writes and is not atomic. No uploads, external autofill, Gmail sync, automatic valuations or unapproved lead/follow-up KPI are introduced.

## Contact deletion verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 151 passed across 12 files, including 27 additional deletion checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts` | Six anonymous browser checks passed, including blocked anonymous DELETE; three live cases skipped |
| `npm run validate:seed` | Passed with all four migrations |
| `npm run db:types:check` | Types still match all 13 tables |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed |

Real local SQL tests verify creator/manager deletion, rejection of colleagues/non-PSE/inactive/anonymous actors, retained actor/before audit data, and protection of company associations, opportunity parties/primary/secondary contacts, meetings and activities. Service/API/SDK tests verify permissions, affected-row checks, same-origin requests and safe HTTP 409 mapping for both PostgreSQL RESTRICT/reference conflict codes. DOM tests verify confirmation, cancellation without a request, pending-state duplicate-submission protection and visible conflict errors.

No hosted migration or contact deletion was executed. The optional live Contacts workflow now exercises linked-company rejection and removes its own fictional records on success; it was skipped. The new migration must be applied by the developer before manually testing hosted deletion. Database types did not change because migration 0004 only adds a grant/policy. Local migration loading now discovers sorted migration files rather than hardcoding the first three.

## Contacts verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 124 passed across 10 files, including 36 new Contacts workflow/query/API/form checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts` | Six anonymous Chromium browser checks passed; three optional live cases skipped |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; contact list/new/detail/edit and API routes compile |

Shared service tests execute against disposable PostgreSQL with RLS to verify persistence/reload, phone-only individuals, optional company links, normalized duplicates, self-exclusion on edit, partial-update preservation, restricted editing and identity/creator mass-assignment rejection. Query-contract tests use the real Supabase SDK with a mocked HTTP transport to inspect pagination, FK selections, quoted filters and safe database-error mapping. API tests exercise authorization, same-origin checks, JSON limits, response statuses and shared-service delegation. DOM tests cover validation, company/individual modes, duplicate warnings, preserved values after conflicts, saving and keyboard selection of internal companies.

Anonymous browser checks additionally verify contact POST/PATCH/duplicate access and detail/edit redirects. The runner initially tried to start a second Next.js dev server; it then successfully reused the developer's existing port-3000 server through `E2E_BASE_URL`. That server was left running. Live login and contact-write tests were explicitly disabled for the run, honoring the developer's manual-testing preference. No hosted contacts, users or profiles were created or changed by these checks.

The optional live contact test requires private demo credentials and `E2E_CONTACT_WRITES=1`; its newer deletion behavior is described in the checkpoint above. It was not run. Production PostgREST joins/filter semantics and full authenticated browser persistence remain part of manual hosted verification; local SQL/service tests and SDK-contract tests do not establish that verification.

## Authentication verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 88 passed: 43 database checks and 45 authentication/action/proxy checks |
| `npm run test:e2e -- sign-in.spec.ts` | Four anonymous Chromium browser tests passed; two optional live-account cases skipped |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; authenticated pages are request-rendered |

Mocked Auth checks cover active member/manager/admin access, missing/inactive/non-PSE/invalid profiles, identity/profile mismatch, rejected sessions, provider failures, caller-scoped profile lookup, manager guards, login field validation, password preservation, safe return paths, logout error handling and cookie forwarding on refresh/redirects. They use no live credentials. Public configuration rejects privileged keys without disclosing their values.

Browser checks cover root-to-login navigation, anonymous dashboard/nested-route redirects, JSON 401 on all seven CRM API stubs, and refusal of external return URLs. The browser suite completed successfully after running outside the restricted sandbox to allow development-server shutdown. The initial sandbox run completed its checks but hung on teardown and was interrupted; it is not counted as a separate pass.

The developer chose to test live sign-in manually. Real demo-account login/logout, cookie expiry/refresh and hosted profile deactivation were not tested by the agent. The developer reports configuring Supabase and applying migrations/RLS; that report is distinct from the automated evidence above. No remote users/profiles were created or changed during this checkpoint.

## Database foundation verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 43 tests passed across contacts/access, financial integrity and target approval |
| `npm run validate:seed` | Migrations and fictional seed applied successfully; reconciliation, financial totals and basic role checks passed |
| `npm run db:types:check` | Generated types matched all 13 migrated tables |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.4.3 |

These database tests execute actual SQL using PostgreSQL 18.6 through PGlite 0.5.11. Each database suite gets a fresh database, with a local-only Auth identity adapter supplying `auth.users`, `auth.uid()` and database roles. These checks do not test hosted Supabase JWTs or real accounts. Do not deploy the adapter as application authentication.

The TypeScript runner initially could not read Windows user information inside the restricted execution sandbox. Seed validation and type generation/checking passed outside that sandbox. Tests, lint, typecheck and build passed. Vitest emits a forward-looking Vite configuration-loader warning; it does not fail the checks.

## Verified database behavior

- Every CRM table enables RLS. Non-PSE and inactive profiles cannot read CRM rows; anonymous access is denied. Active PSE members can read colleagues' permitted records.
- Client profile escalation, forged creator/recorder identities and direct audit writes are denied. Internal privileged functions use fixed search paths and restricted execution grants.
- Contacts require email or phone; normalized duplicates fail. Individuals may exist without a company. Company associations, URLs and contact-kind integrity are checked.
- Company opportunity primary/secondary contacts and optional budgets persist in the fictional seed. Meetings may use the company party or designated individual contact; contradictory links and parent edits that break existing links are rejected.
- Independent activities retain person/organization context and remaining work without CRM links.
- Forecasts, operational budgets, unvalued activity estimates and recognized contributions stay separate. Invalid/non-finite financial amounts and currency/type mismatches are rejected. Mixed-currency totals are checked separately.
- Agreed in-kind notes and estimate references persist. Contribution rows retain explicit employee/vertical attribution when opportunity ownership changes. Contributions are append-only; automatic valuation is absent.
- Manager approval requires four quarters summing to the annual amount and a reconciled employee/vertical grid for every quarter. Members cannot approve or edit targets. Direct status updates cannot bypass reconciliation.
- Approved headers, quarterly baselines and allocation cells are immutable. Q1 achievement remains 110% and Q2's 250,000 BDT target stays unchanged in the seed.
- Audit snapshots retain the actor and before/after values. Audit history is immutable and hides unrelated non-PSE profile history. Historical notes can still be edited by an authorized manager after an owner is deactivated.

## Remaining checks and limitations

- Independent hosted Supabase role/security verification and live Auth sessions remain pending manual checks. The local engine uses PostgreSQL 18; verify compatibility against the selected hosted PostgreSQL version when integrating.
- Parent-row locks serialize target edits and approval in the SQL design. The single-connection local harness does not prove multi-session race behavior; add a two-session hosted/local-server test during integration.
- Contacts, Opportunities, Meetings and Activities forms/services, including inline New Deal contact creation, stage configuration and meeting follow-up task creation, are implemented. Target/contribution-entry workflows, dashboard queries, contacts-engaged KPI, application cache and production deployment remain pending. Target E2E remains a placeholder; Meetings/Opportunities/Activities E2E cover anonymous boundaries only.
- Contact history is a recent-record view: up to 10 opportunities, 10 meetings and 20 activities, including indirect links only through the recent parents shown. It is not an exhaustive report. Unlinked contact/opportunity deletion is implemented as a user-requested addition with FK protection and retained audit history; active/inactive contact lifecycle remains unresolved.
- Phone normalization strips formatting only; it does not infer country codes, leading-zero rules or extensions. Imports/entry must use consistent international numbers and review ambiguous matches.
- Currency codes are syntactically uppercase three-letter identifiers; no exchange rates, currency conversion or full currency registry is implemented.
- Percentage entry/rounding is a later application workflow; canonical allocation amounts are stored once. Final pipeline stages, vertical mappings and reporting formulas remain provisional.
- Refund/contribution correction and deletion workflows are not implemented. Application clients cannot edit/delete realized contributions or approved targets.
- The seed contains fixed fictional Auth/profile identifiers, not login credentials. Hosted import requires trusted identity provisioning and reviewed mappings. No real JAAGO/Odoo data was migrated.

## Earlier scaffold verification

On 26 October 2026, local production-server HTTP smoke checks confirmed root/sign-in, dashboard, contact list/new/detail placeholders returned HTTP 200 and the contacts API returned HTTP 501. These were scaffold checks; they did not verify contact forms, login or private data access.

See [the local test guide](06-user-guide.md) for reproducible commands.
