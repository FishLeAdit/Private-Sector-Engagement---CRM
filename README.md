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

For the web app, copy `.env.example` to `.env.local`, configure the Supabase URL and publishable key, then run `npm run dev` and open http://localhost:3000/login. The project needs the migrations applied (`npx.cmd supabase db push --linked` applies any pending ones from `supabase/migrations`; 0001–0017 are applied to the hosted demo) and a trusted active PSE profile matching the Auth user's UUID. Ordinary sign-in uses no service-role key. Restart the development server after changing environment variables.

Sign in with a provisioned PSE account to enter the workspace. Open Contacts to manage individuals/companies, Opportunities to manage financial deals, Meetings to schedule conversations and create follow-ups, or Activities to log independent/linked work, change status, edit and delete entries. Contact/Opportunity details provide a Schedule meeting shortcut. Your name at the foot of the navigation opens Settings and Sign out. A manager can configure stages/categories in Settings → Pipeline, and check and import Odoo CSV exports in Settings → Odoo import check; the superadmin also manages accounts in Settings → Accounts. An empty project needs active stages and categories before creating a deal. The disposable local seed database is not displayed by the web app.

Roles are staff (`pse_member`), manager (`pse_manager`) and superadmin (`admin`). The superadmin creates accounts, sets their role, restricts and deletes them in Settings → Accounts; creating sign-ins and setting passwords need `SUPABASE_SERVICE_ROLE_KEY` on the server. The first superadmin is set in the Supabase SQL Editor; see [roles and the superadmin](docs/04-api-and-permissions.md#roles-and-the-superadmin).

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
- `npm test`: run 761 database, authentication, Contacts/Opportunities/Meetings/Activities service/API/query, form and demo-seed checks.
- `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts activities.spec.ts contributions.spec.ts targets.spec.ts reports.spec.ts`: run browser checks; starts a local server on port 3100 automatically. Install Chromium with `npx playwright install chromium` first. If your app is already running on port 3000, set `E2E_BASE_URL=http://localhost:3000` in the test terminal. Live cases skip without demo credentials; the signed-in specs in `tests/e2e/live` additionally require `E2E_LIVE_WRITES=1` and create and delete "QA …" records on the configured project.
- `npm.cmd run benchmark:reports`: reproduce the isolated 10,002-receipt SQL/cache-policy timing and privacy/correctness checks; no hosted credentials or writes.
- `npm run validate:seed`: apply migrations and fictional seed, then verify financial totals, target reconciliation and basic visibility.
- `npm run seed:demo`: preview fictional contacts/company/deal inserts for the configured hosted Supabase project; on Windows PowerShell, `npm.cmd run seed:demo -- --apply` inserts the missing demo rows. Requires a private server-side key and an existing active PSE profile; see [demo data setup](docs/06-user-guide.md#add-demo-data-to-the-web-app).
- `npm.cmd run seed:meetings`: preview six fictional meetings using existing demo contacts/deals; add `-- --apply` to insert missing meetings without changing/recreating their parents or overwriting existing meetings.
- `npm.cmd run seed:activities`: preview 11 fictional activities, one per assessment type; add `-- --apply` to insert missing rows while preserving existing activities and parents.
- `npm.cmd run seed:accounts`: preview renaming the generic demo profiles to fictional named staff (two managers, three members) and creating the missing ones; add `-- --superadmin=<email>` to make one existing account the superadmin and `-- --apply` to write. New sign-ins get random passwords that are not shown.
- `npm.cmd run seed:team`: preview fictional contacts, deals, meetings and activities owned by the named staff (run `seed:accounts` first); add `-- --apply` to insert the missing ones. No contributions are recorded.
- `npm.cmd run seed:finance`: preview six fictional receipts, two draft BDT target plans and three provisional demo verticals; add `-- --apply` to insert missing examples while preserving existing records and edits.
- `npm.cmd run odoo:dry-run`: check Odoo CSV exports (by default the fictional templates in `public/odoo-templates`; Settings → Odoo import check runs the same rules in the app) against the CRM's create rules, links and duplicates, and print what needs review. It only reads; the columns await PSE's field mapping. See [migration plan](docs/08-migration-plan.md).
- `npm run db:types`: regenerate TypeScript types by inspecting the migrated local database catalog.
- `npm run db:types:check`: fail if generated types no longer match migrations.

## Current status (28 October 2026)

**Live demo:** https://private-sector-engagement-crm.vercel.app. Reviewer sign-in details are shared privately, not in this repository.

### What you can do

| Area | Built |
|---|---|
| Contacts | Individuals and companies with people linked to their company; search and filters; duplicate email/phone checks; recent related history; confirmed deletion while nothing links to the contact |
| Opportunities | Financial deals with a party, primary and secondary contacts, expected value, optional operational budget and valuation notes for in-kind support; list view and a full stage board (every matching deal, totals per stage and currency); audited stage moves |
| Meetings | Scheduled, Done and Cancelled meetings linked to a contact or a deal, with follow-up tasks |
| Activities | All 11 activity types, with or without a CRM link, status, remaining work and category filters |
| Contributions | Append-only received cash and valued in-kind support, credited to an employee and optional vertical, only on open or won deals; manager-only corrections for refunds or mistakes |
| Targets | Annual plans with uneven quarters, member amounts split across verticals by percentage, exact reconciliation and permanent approval; actual versus target by quarter, employee and vertical |
| Dashboard and Reports | A team overview and detailed reports that keep monetary fundraising apart from non-monetary work; pipeline, workload, meetings and a provisional contacts-engaged figure; permission-scoped caching |
| Settings | Pipeline stages and categories; an Odoo import check that imports files once nothing needs review; and, for the superadmin, account management |

Access is role-based and enforced twice, in the server and in PostgreSQL row-level security: staff (`pse_member`), manager (`pse_manager`: targets, configuration, assigning owners, corrections, Odoo import) and superadmin (`admin`: also accounts and draft-plan deletion). Only active PSE profiles can use the CRM. Expected deal value is a forecast; only recognized contributions count as achievement, and currencies are never converted.

### Demo data on the hosted project

All fictional. A superadmin and five named staff (two managers, three members) own the `Demo |` contacts, deals, meetings and activities, so owner filters and the workload reports show a real spread. The 2026 BDT draft plan targets 1,000,000 with Q1 at 110% (165,000 of 150,000) and Q2 unchanged; a separate USD receipt stays out of BDT totals. Settings → Odoo import check has a "mixed" sample set with a problem of every kind and a "ready" set that imports.

### Waiting on PSE

These are labelled provisional in the app and listed in [requirements and assumptions](docs/01-requirements-and-assumptions.md): final pipeline stages; contribution categories versus target verticals (VBD and SAC); lead and follow-up-rate KPIs (not built); the contacts-engaged definition; meeting, event and monthly targets; contact active/inactive status; the target hierarchy; the refund policy behind corrections; and the Odoo field mapping before any real import.

### How it was verified

803 unit, database and component tests (real SQL with every migration in PGlite for the database rules), lint, typecheck, production build, seed validation and a generated-types check all pass. 32 Playwright browser tests cover anonymous boundaries, sign-in and a restricted account, and opt-in signed-in specs that create and delete their own QA records against the hosted demo. Evidence for each change, and the known limitations, are in [testing and limitations](docs/07-testing-and-limitations.md); the [user guide](docs/06-user-guide.md) walks through every workflow.

### Known limits

Report caching assumes one server instance until a shared cache handler is verified (`PSE_REPORT_CACHE_ENABLED=false` turns it off). Phone numbers are normalized by stripping formatting only. No real JAAGO or Odoo data has been migrated. Direct uploads, Gmail sync, external autofill and unapproved KPIs are out of scope.
