# Testing and limitations

The database foundation, authentication, Contacts and financial Opportunities workflows are implemented. Other CRM modules remain scaffolds. Evidence below distinguishes PostgreSQL/service tests, mocked transports/form tests, anonymous browser checks and hosted verification that remains manual.

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
- Contacts and Opportunities forms/services, including inline New Deal contact creation and stage configuration, are implemented. Meetings, Activities, target/contribution-entry workflows, dashboard queries, contacts-engaged KPI, application cache and production deployment remain pending. Target E2E remains a placeholder; opportunity E2E covers anonymous boundaries only.
- Contact history is a recent-record view: up to 10 opportunities, 10 meetings and 20 activities, including indirect links only through the recent parents shown. It is not an exhaustive report. Unreferenced contact deletion is implemented as a user-requested addition; active/inactive contact lifecycle remains unresolved.
- Phone normalization strips formatting only; it does not infer country codes, leading-zero rules or extensions. Imports/entry must use consistent international numbers and review ambiguous matches.
- Currency codes are syntactically uppercase three-letter identifiers; no exchange rates, currency conversion or full currency registry is implemented.
- Percentage entry/rounding is a later application workflow; canonical allocation amounts are stored once. Final pipeline stages, vertical mappings and reporting formulas remain provisional.
- Refund/contribution correction and deletion workflows are not implemented. Application clients cannot edit/delete realized contributions or approved targets.
- The seed contains fixed fictional Auth/profile identifiers, not login credentials. Hosted import requires trusted identity provisioning and reviewed mappings. No real JAAGO/Odoo data was migrated.

## Earlier scaffold verification

On 26 October 2026, local production-server HTTP smoke checks confirmed root/sign-in, dashboard, contact list/new/detail placeholders returned HTTP 200 and the contacts API returned HTTP 501. These were scaffold checks; they did not verify contact forms, login or private data access.

See [the local test guide](06-user-guide.md) for reproducible commands.
