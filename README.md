# PSE CRM

Next.js App Router + TypeScript application with Supabase authentication, PSE access checks, Contacts, financial Opportunities and Meetings with linked follow-up tasks, independent or linked Activities, recognized contribution entry and target allocation, based on the documented [requirements and assumptions](docs/01-requirements-and-assumptions.md). Dashboard, detailed reports and permission-scoped caching are implemented; signed-in acceptance, deployment and real Odoo import remain later work.

## Local setup

Use Node.js 22.12 or newer in the 22 LTS line. Run `npm ci` to install the locked dependencies. The local database checks need no credentials, Docker, Supabase account or running web server.

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

The database tests/seed validator create fresh in-memory PostgreSQL databases with PGlite, apply migrations and close them when finished. Type consistency needs only the schema. Authentication unit tests use mocked providers. No test data survives these commands and no hosted project is changed; these checks do not verify live Supabase JWTs or credentials.

For the web app, copy `.env.example` to `.env.local`, configure the Supabase URL and publishable key, then run `npm run dev` and open http://localhost:3000/login. The project needs the migrations applied and a trusted active PSE profile matching the Auth user's UUID. Ordinary sign-in uses no service-role key. Restart the development server after changing environment variables.

Sign in with a provisioned PSE account to enter the workspace. Open Contacts to manage individuals/companies, Opportunities to manage financial deals, Meetings to schedule conversations and create follow-ups, or Activities to log independent/linked work, change status, edit and delete entries. Contact/Opportunity details provide a Schedule meeting shortcut. A manager can configure stages/categories in Settings; an empty project needs active entries before creating a deal. The disposable local seed database is not displayed by the web app.

## Structure

- `src/app`: page files and API routes. Pages load data and compose components; routes are thin wrappers around feature services.
- `src/features/<module>`: each CRM area's Zod schemas, types and error class, caller-scoped repository (`queries.ts`), service and page/API wiring. Contributions and targets share `features/finance`.
- `src/components/<module>`: each area's forms, filters, tables and detail sections; `src/components/ui` holds pieces shared by every module (form fields, filters, list headers, pagination, delete confirmation, audit history).
- `src/lib`: shared API/page wiring, errors and validation, authorization guards, report caching, money and Asia/Dhaka date helpers, and Supabase clients.
- `supabase`: executable schema, RLS, trigger/index migrations and fictional local seed.
- `docs`: technical documentation and editable Mermaid diagrams.
- `tests/unit`: PostgreSQL-backed database/service checks plus authentication, API, form and query-contract tests.
- `tests/e2e`: anonymous sign-in/contact/opportunity/meeting/activity checks, optional live login checks, and opt-in signed-in specs in `tests/e2e/live` that create and delete "QA …" records; target/contribution/report browser checks cover anonymous boundaries.
- `scripts/lib/local-database.ts`: isolated local Auth adapter and migration runner; never deploy its Auth bootstrap.

Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts`. Tailwind CSS 4 uses its PostCSS plugin and CSS configuration. `components.json` reserves component aliases; no shadcn components have been generated. See [code organization](docs/02-system-architecture.md#code-organization) for how the layers fit together.

## Commands

- `npm run dev`: local development.
- `npm run lint`: ESLint, then Prettier's formatting check. ESLint also warns when a source file in `src` passes 300 lines.
- `npm run format` / `npm run format:check`: apply or verify Prettier formatting. Migrations, docs, Markdown and generated files (`src/types/database.types.ts`, `next-env.d.ts`) are excluded in `.prettierignore`.
- `npm run typecheck`: TypeScript.
- `npm run build`: production build.
- `npm test`: run 660 database, authentication, Contacts/Opportunities/Meetings/Activities service/API/query, form and demo-seed checks.
- `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts activities.spec.ts contributions.spec.ts targets.spec.ts reports.spec.ts`: run browser checks; starts a local server on port 3100 automatically. Install Chromium with `npx playwright install chromium` first. If your app is already running on port 3000, set `E2E_BASE_URL=http://localhost:3000` in the test terminal. Live cases skip without demo credentials; the signed-in specs in `tests/e2e/live` additionally require `E2E_LIVE_WRITES=1` and create and delete "QA …" records on the configured project.
- `npm.cmd run benchmark:reports`: reproduce the isolated 10,002-receipt SQL/cache-policy timing and privacy/correctness checks; no hosted credentials or writes.
- `npm run validate:seed`: apply migrations and fictional seed, then verify financial totals, target reconciliation and basic visibility.
- `npm run seed:demo`: preview fictional contacts/company/deal inserts for the configured hosted Supabase project; on Windows PowerShell, `npm.cmd run seed:demo -- --apply` inserts the missing demo rows. Requires a private server-side key and an existing active PSE profile; see [demo data setup](docs/06-user-guide.md#add-demo-data-to-the-web-app).
- `npm.cmd run seed:meetings`: preview six fictional meetings using existing demo contacts/deals; add `-- --apply` to insert missing meetings without changing/recreating their parents or overwriting existing meetings.
- `npm.cmd run seed:activities`: preview 11 fictional activities, one per assessment type; add `-- --apply` to insert missing rows while preserving existing activities and parents.
- `npm.cmd run seed:finance`: preview six fictional receipts, two draft BDT target plans and three provisional demo verticals; add `-- --apply` to insert missing examples while preserving existing records and edits.
- `npm run db:types`: regenerate TypeScript types by inspecting the migrated local database catalog.
- `npm run db:types:check`: fail if generated types no longer match migrations.

## Current status

Implemented locally: 13 tables, database constraints, RLS, immutable audit history, fictional seed, generated database types and transactional target approval with locked baselines. Quarter totals and the employee/vertical allocation grid reconcile before approval. Realized contributions are separate from forecasts, budgets and activity recognition estimates; currencies are never automatically converted.

Implemented authentication: typed browser/server Supabase clients, email/password login, current-session logout, cookie refresh, verified identity and active PSE membership checks. Protected pages redirect anonymous users to login and restricted accounts to an access-denied page. HTTP guards return JSON 401/403/503. Auth responses are private and not cached. Profile roles come from the database, not client input.

Implemented Contacts: list/search/type/company filters with 20-row pagination; create, detail and edit pages; shared client/server validation; internal company lookup; duplicate warnings and conflict handling; related recent history. Members can edit/delete their own contacts; managers may edit/delete any contact. Deletion requires confirmation, is blocked while a contact is referenced, and retains the audit snapshot. Contact type/creator identity remain immutable. Contacts API GET/POST/detail/PATCH/DELETE and duplicate checks are implemented.

Contact deletion uses migration 0004, opportunity deletion uses 0005, meeting deletion uses 0006, and activity deletion uses 0007. Phase 10 adds migration 0008 for atomic drafts, versioned approval, contribution retry protection and actual aggregation. The administrative finance seed adds service-role-only migration 0009 for atomic new demo target inserts. Migrations 0010/0011 enforce related Activity context and add caller-scoped reporting. Migration 0012 accepts new contributions only on open or won deals, and 0013 lets members credit only themselves while managers may credit any active employee. Migration 0014 adds the provisional contacts-engaged figures to the report. Migrations 0001–0014 are applied to the configured hosted project. Apply any newer migration with `npx.cmd supabase db push --linked` before deploying the code that relies on it. For another linked project, use `npx.cmd supabase db push --linked` to apply pending migrations. The local test runner discovers/applies all migration files automatically.

Implemented Opportunities: financial deal create/detail/edit/delete; search and owner/stage/category/type/currency/closing-date filters; paginated list and stage board; audited stage changes; linked individual/company and primary/secondary contact information; inline contact creation preserving the deal draft; optional operational budget, payment interval, country, closing date, description, notes and reference URLs. Valued in-kind deals require an agreed manual valuation note. Expected values and recent recognized contributions are shown separately; Won does not create actuals. Managers configure stages/categories and may explicitly load provisional assessment examples. The focal person, creator or an active PSE manager can delete an unlinked opportunity after confirmation. Meetings, activities and recognized contributions block deletion; contacts and audit history are retained. Migration 0005 was applied to the hosted project without deleting existing deals.

Hosted demo data was inserted and verified on 26 October 2026: 3 fictional companies, 8 individuals and 8 opportunities owned by the existing Demo Manager. Search `Demo |` in Contacts/Opportunities. Existing stage/category configuration was reused; no received contributions were created. A subsequent read-only preview found all 19 demo records and no missing inserts.

Implemented Meetings: create/detail/edit/delete, Scheduled/Done/Cancelled status, list/title/owner/status/date and upcoming/completed filters with 20-row pagination. Meetings link to a contact or opportunity; opportunity-only meetings display derived primary/party contact information, including designation and communication details. Input/display uses Asia/Dhaka and storage uses UTC. Owners/creators/managers edit/delete under RLS; only managers assign other owners. Details show recent linked activities/audit history and create open follow-up tasks inheriting the meeting's saved links. Deletion requires confirmation, is blocked by activities/follow-ups, and preserves contacts, opportunities and audit history. Follow-up tasks open in Activities for editing, status changes and deletion.

Six hosted demo meetings were inserted and verified for Demo Manager: three Scheduled, two Done and one Cancelled, including contact-only and opportunity-linked examples. Refresh Meetings and search `Demo |`. Existing records are preserved on reruns, and no financial/activity rows were created by the meeting seed. See the [assessment alignment check](docs/01-requirements-and-assumptions.md#meetings-assessment-check) for confirmed requirements versus project additions.

Implemented Activities: list/search/type/category/status/owner/date/direct-link filters, 20-row pagination, create/detail/edit/status/delete and recent audits. All 11 assessment types support independent work with optional person/organization context and optional contact/opportunity/meeting links. Internal lookups and SQL guards keep linked context compatible. Notes are required as a project data-quality choice; dates are optional and use Asia/Dhaka input/display with UTC storage. Named deletion confirmation and owner/creator/manager RLS preserve audit history and parents. Manual email, events, stewardship and unvalued gifts create no financial achievement. Legacy non-monetary estimates are neither edited nor reset.

Eleven hosted demo activities were seeded for Demo Manager on 27 October 2026, including every required type, independent work, direct contact/deal links and linked meetings. Search `Demo |` in Activities. Reruns preserve existing edits and add only missing stable IDs.

Implemented Phase 10: append-only actual contribution entry from opportunity details, with explicit employee/optional vertical attribution, manual in-kind evidence, review and retry protection; annual target drafts, uneven quarters, member amounts split across verticals by percentage, exact reconciliation, manager approval/locking and live target-versus-actual views. Draft snapshots are transactional with stale-write protection. Recognition time determines quarter/year in Asia/Dhaka, currencies stay separate, unassigned actuals remain visible, and overachievement leaves future targets unchanged. Managers configure verticals without finalized category mappings.

Implemented Phase 11: filtered dashboard and detailed reports with actual-versus-target, remaining/overachievement, cash/in-kind, explicit employee/vertical performance, pipeline stage/outcome forecasts, activity/meeting counts and monthly trends. Every chart uses a live SQL aggregate over eligible rows, not hardcoded demo data or a paginated client sum. Monthly views show actuals without invented monthly targets; draft targets are labeled provisional. Vertical applies only to funding attribution/targets; workload is independent of currency and vertical. See [report definitions](docs/09-reporting-definitions.md).

Activity context is now mandatory through a related person/organization or a valid CRM link, enforced in shared validation and SQL. Legacy rows remain readable and show a correction notice; new/updated context-free entries are rejected. Existing rows are not fabricated or silently backfilled.

Implemented Phase 12: 30-second report and five-minute vertical metadata caches scoped to project/user/role/session/filters, fresh authentication/profile lookup on every request, redacted cached profile names, immediate write/Refresh tag expiry and an uncached override. See [caching strategy and benchmark](docs/05-caching-strategy.md).

Pending: signed-in/multi-instance acceptance, production deployment and Odoo import after PSE provides mappings. Hosted migrations/RLS are already configured; live-account and authenticated browser persistence/joins remain manual checks. No real donor data, passwords or secrets are included.

The [database schema](docs/03-database-schema.md) describes the current storage model. Forecast values must remain separate from recognized achievement; pipeline stages and target verticals remain configurable and provisional.

The requirements register distinguishes confirmed Word-assessment requirements from proposed technical choices and unverified recruitment email requirements. Secondary company contacts remain optional pending confirmation. Creator/owner/manager edit rules and manager-only pipeline configuration are implementation choices. The board and currency subtotals cover the current page of up to 20 deals; they are not full-pipeline reporting. Direct uploads, external autofill, Gmail sync and unapproved lead/follow-up KPIs are excluded.

All 660 unit/database/service/API/form/demo-seed checks, nineteen anonymous browser checks, seed/type checks, lint, typecheck and production build passed. With the demo and restricted accounts configured and `E2E_LIVE_WRITES=1`, all 26 browser checks pass, including the signed-in specs. See [verification details](docs/07-testing-and-limitations.md) and the [user guide](docs/06-user-guide.md). Next checkpoint: signed-in acceptance and deployment preparation.


Open **Targets** to view performance or, as an authorized manager, configure verticals and create a draft. From an opportunity, choose **Record contribution** to enter actual received support; expected value is never prefilled as achievement. See [Phase 10 manual checks](docs/06-user-guide.md#try-phase-10-contributions-and-targets). Financial receipts are append-only: refunds/corrections are outside this release. The subsequent requested finance seed added six fictional receipts and two draft target plans. See the demo dataset below.


Hosted finance examples: **2026 BDT** has a 1,000,000 annual target (150,000 / 250,000 / 250,000 / 350,000 by quarter), 12 employee/vertical allocation cells and 280,000 BDT recognized overall. Q1 is 165,000 / 150,000 = **110%**, with Q2 still 250,000. A separate 200 USD receipt is kept outside BDT achievement. **2027 BDT** is an incomplete 1,200,000 draft for allocation practice. Both plans remain drafts for your review/approval. Three `Demo |` verticals are explicitly provisional; six receipts are labeled fictional in Notes. Administrative seeding preserves saved edits and existing parents; normal signed-in entry and approval still use the caller's permissions.


Open **Dashboard** for the overview or **Reports** for full stage, employee/vertical, owner and monthly tables. Select 2026/Q1/BDT to inspect the seeded 110% quarter, or the full year for 280,000 BDT against the draft 1,000,000 target. Use **Refresh data** after changes. Contacts engaged is shown with a provisional definition awaiting PSE; lead and follow-up-rate KPIs are omitted until definitions are approved. Dashboard and Reports share permission-scoped cached snapshots with fresh access checks. Use Refresh data to request a new snapshot; ordinary reloads can reuse up to 30 seconds of report data.


Local cache-policy benchmark (10,002 selected receipts): median 46.333 ms uncached versus 5.316 ms warm, with fresh local membership/profile reads in both paths. This excludes hosted Auth/HTTP and production cache storage; it is not a production page-speed claim. `PSE_REPORT_CACHE_ENABLED=false` disables caching, including for deployments awaiting shared-handler verification. No hosted schema or business data changed in Phase 12.
