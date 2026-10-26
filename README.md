# PSE CRM

Next.js App Router + TypeScript application with Supabase authentication, PSE access checks, Contacts and financial Opportunities workflows, and a locally verified PostgreSQL database foundation, based on the documented [requirements and assumptions](docs/01-requirements-and-assumptions.md). Other CRM workflows remain under development.

## Local setup

Use Node.js 22.12 or newer in the 22 LTS line. Run `npm ci` to install the locked dependencies. The local database checks need no credentials, Docker, Supabase account or running web server.

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

The database tests/seed validator create fresh in-memory PostgreSQL databases with PGlite, apply migrations and close them when finished. Type consistency needs only the schema. Authentication unit tests use mocked providers. No test data survives these commands and no hosted project is changed; these checks do not verify live Supabase JWTs or credentials.

For the web app, copy `.env.example` to `.env.local`, configure the Supabase URL and publishable key, then run `npm run dev` and open http://localhost:3000/login. The project needs the migrations applied and a trusted active PSE profile matching the Auth user's UUID. Ordinary sign-in uses no service-role key. Restart the development server after changing environment variables.

Sign in with a provisioned PSE account to enter the workspace. Open Contacts to manage individuals/companies, or Opportunities to create financial deals, edit them and move stages in a list/board. A manager can configure stages/categories in Settings; an empty project needs active entries before creating a deal. The disposable local seed database is not displayed by the web app.

## Structure

- `src/app`: pages, dashboard shell, Contacts/Opportunities APIs and remaining API stubs.
- `src/components`: reusable UI organized by module.
- `src/features`: validation, queries and business services.
- `src/lib`: database, authorization, cache and formatting helpers.
- `supabase`: executable schema, RLS, trigger/index migrations and fictional local seed.
- `docs`: technical documentation and editable Mermaid diagrams.
- `tests/unit`: PostgreSQL-backed database/service checks plus authentication, API, form and query-contract tests.
- `tests/e2e`: anonymous sign-in/contact/opportunity checks, optional live login checks and an explicitly opted-in fictional contact write workflow; target E2E remains a placeholder.
- `scripts/lib/local-database.ts`: isolated local Auth adapter and migration runner; never deploy its Auth bootstrap.

Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts`. Tailwind CSS 4 uses its PostCSS plugin and CSS configuration. `components.json` reserves component aliases; no shadcn components have been generated. Empty planned directories use `.gitkeep`.

## Commands

- `npm run dev`: local development.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript.
- `npm run build`: production build.
- `npm test`: run 206 database, authentication, Contacts/Opportunities service/API/query, form and demo-seed checks.
- `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts`: run browser checks; starts a local server on port 3100 automatically. Install Chromium with `npx playwright install chromium` first. If your app is already running on port 3000, set `E2E_BASE_URL=http://localhost:3000` in the test terminal. Live cases skip without demo credentials; contact writes additionally require `E2E_CONTACT_WRITES=1`.
- `npm run validate:seed`: apply migrations and fictional seed, then verify financial totals, target reconciliation and basic visibility.
- `npm run seed:demo`: preview fictional contacts/company/deal inserts for the configured hosted Supabase project; on Windows PowerShell, `npm.cmd run seed:demo -- --apply` inserts the missing demo rows. Requires a private server-side key and an existing active PSE profile; see [demo data setup](docs/06-user-guide.md#add-demo-data-to-the-web-app).
- `npm run db:types`: regenerate TypeScript types by inspecting the migrated local database catalog.
- `npm run db:types:check`: fail if generated types no longer match migrations.

## Current status

Implemented locally: 13 tables, database constraints, RLS, immutable audit history, fictional seed, generated database types and transactional target approval with locked baselines. Quarter totals and the employee/vertical allocation grid reconcile before approval. Realized contributions are separate from forecasts, budgets and activity recognition estimates; currencies are never automatically converted.

Implemented authentication: typed browser/server Supabase clients, email/password login, current-session logout, cookie refresh, verified identity and active PSE membership checks. Protected pages redirect anonymous users to login and restricted accounts to an access-denied page. HTTP guards return JSON 401/403/503. Auth responses are private and not cached. Profile roles come from the database, not client input.

Implemented Contacts: list/search/type/company filters with 20-row pagination; create, detail and edit pages; shared client/server validation; internal company lookup; duplicate warnings and conflict handling; related recent history. Members can edit/delete their own contacts; managers may edit/delete any contact. Deletion requires confirmation, is blocked while a contact is referenced, and retains the audit snapshot. Contact type/creator identity remain immutable. Contacts API GET/POST/detail/PATCH/DELETE and duplicate checks are implemented.

To enable deletion in an already configured hosted project, apply the new `0004_contact_deletion.sql` migration with `npx supabase db push`. The local test runner discovers/applies all migration files automatically. No hosted migration or deletion was performed by the agent for this checkpoint.

Implemented Opportunities: financial deal create/detail/edit; search and owner/stage/category/type/currency/closing-date filters; paginated list and stage board; audited stage changes; linked individual/company and primary/secondary contact information; inline contact creation preserving the deal draft; optional operational budget, payment interval, country, closing date, description, notes and reference URLs. Valued in-kind deals require an agreed manual valuation note. Expected values and recent recognized contributions are shown separately; Won does not create actuals. Managers configure stages/categories and may explicitly load provisional assessment examples. This checkpoint needs no new migration.

Hosted demo data was inserted and verified on 26 October 2026: 3 fictional companies, 8 individuals and 8 opportunities owned by the existing Demo Manager. Search `Demo |` in Contacts/Opportunities. Existing stage/category configuration was reused; no received contributions were created. A subsequent read-only preview found all 19 demo records and no missing inserts.

Pending: meetings/activities/targets/contribution-entry workflows, reporting, caching, production deployment and manual hosted workflow verification. Hosted migrations/RLS were reported applied by the developer; live-account and authenticated hosted persistence/joins remain manual checks. No real donor data, passwords or secrets are included.

The [database schema](docs/03-database-schema.md) describes the current storage model. Forecast values must remain separate from recognized achievement; pipeline stages and target verticals remain configurable and provisional.

The requirements register distinguishes confirmed Word-assessment requirements from proposed technical choices and unverified recruitment email requirements. Secondary company contacts remain optional pending confirmation. Creator/owner/manager edit rules and manager-only pipeline configuration are implementation choices. The board and currency subtotals cover the current page of up to 20 deals; they are not full-pipeline reporting. Direct uploads, external autofill, Gmail sync and unapproved lead/follow-up KPIs are excluded.

All 206 unit/database/service/API/form/demo-seed checks, eight anonymous browser checks, seed/type consistency, lint, typecheck and production build passed. Three optional live cases were skipped. See [verification details](docs/07-testing-and-limitations.md) and the [user guide](docs/06-user-guide.md). Next checkpoint: Meetings and linked follow-up Activities.
