# PSE CRM

Next.js App Router + TypeScript application with Supabase authentication, PSE access checks and a locally verified PostgreSQL database foundation, based on the documented [requirements and assumptions](docs/01-requirements-and-assumptions.md). CRM workflows remain under development.

## Local setup

Use Node.js 22.12 or newer in the 22 LTS line. Run `npm ci` to install the locked dependencies. The local database checks need no credentials, Docker, Supabase account or running web server.

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

The database tests/seed validator create fresh in-memory PostgreSQL databases with PGlite, apply migrations and close them when finished. Type consistency needs only the schema. Authentication unit tests use mocked providers. No test data survives these commands and no hosted project is changed; these checks do not verify live Supabase JWTs or credentials.

For the web app, copy `.env.example` to `.env.local`, configure the Supabase URL and publishable key, then run `npm run dev` and open http://localhost:3000/login. The project needs the migrations applied and a trusted active PSE profile matching the Auth user's UUID. Ordinary sign-in uses no service-role key. Restart the development server after changing environment variables.

Sign in with a provisioned PSE account to enter the workspace. The header shows the display name/role and a Sign out button. Restricted accounts cannot enter. CRM pages remain placeholders and do not display the disposable local seed database.

## Structure

- `src/app`: pages, dashboard shell and API stubs.
- `src/components`: reusable UI organized by module.
- `src/features`: validation, queries and business services.
- `src/lib`: database, authorization, cache and formatting helpers.
- `supabase`: executable schema, RLS, trigger/index migrations and fictional local seed.
- `docs`: technical documentation and editable Mermaid diagrams.
- `tests/unit`: PostgreSQL-backed database checks plus authentication, server-action and proxy tests.
- `tests/e2e/sign-in.spec.ts`: anonymous browser checks and optional live demo-account cases; other E2E files remain placeholders.
- `scripts/lib/local-database.ts`: isolated local Auth adapter and migration runner; never deploy its Auth bootstrap.

Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts`. Tailwind CSS 4 uses its PostCSS plugin and CSS configuration. `components.json` reserves component aliases; no shadcn components have been generated. Empty planned directories use `.gitkeep`.

## Commands

- `npm run dev`: local development.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript.
- `npm run build`: production build.
- `npm test`: run 88 database/authentication checks for access, actions, redirects, cookies, auditing and fixed targets.
- `npm run test:e2e -- sign-in.spec.ts`: run browser auth checks; starts a local server on port 3100 automatically. Install Chromium with `npx playwright install chromium` first. Live cases skip unless optional private demo credentials are configured.
- `npm run validate:seed`: apply migrations and fictional seed, then verify financial totals, target reconciliation and basic visibility.
- `npm run db:types`: regenerate TypeScript types by inspecting the migrated local database catalog.
- `npm run db:types:check`: fail if generated types no longer match migrations.

## Current status

Implemented locally: 13 tables, database constraints, RLS, immutable audit history, fictional seed, generated database types and transactional target approval with locked baselines. Quarter totals and the employee/vertical allocation grid reconcile before approval. Realized contributions are separate from forecasts, budgets and activity recognition estimates; currencies are never automatically converted.

Implemented authentication: typed browser/server Supabase clients, email/password login, current-session logout, cookie refresh, verified identity and active PSE membership checks. Protected pages redirect anonymous users to login and restricted accounts to an access-denied page. HTTP guards return JSON 401/403/503; authorized API requests still return HTTP 501 until business workflows are implemented. Auth responses are private and not cached. Profile roles come from the database, not client input.

Pending: Contacts and other CRM services/forms, reporting, caching, production deployment and live-account sign-in/revocation/refresh verification. Hosted migrations/RLS were reported applied by the developer; live login testing is being done manually by the developer. No real donor data, passwords or secrets are included.

The [database schema](docs/03-database-schema.md) describes the current storage model. Forecast values must remain separate from recognized achievement; pipeline stages and target verticals remain configurable and provisional.

The requirements register distinguishes confirmed Word-assessment requirements from proposed technical choices and unverified recruitment email requirements. It includes company primary/secondary contact details, optional operational budgets, independent activity context/remaining work, contacts-engaged reporting and manual in-kind valuation supplied by the operational team. These application workflows remain pending implementation.

All 88 unit/database checks, four anonymous browser checks, lint, typecheck and production build passed. Two optional live-account browser cases were skipped. See [verification details](docs/07-testing-and-limitations.md) and the [test/sign-in guide](docs/06-user-guide.md). Next checkpoint: Contacts CRUD.
