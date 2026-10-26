# PSE CRM

Next.js App Router + TypeScript scaffold and locally verified PostgreSQL database foundation for the JAAGO Private Sector Engagement CRM, based on the documented [requirements and assumptions](docs/01-requirements-and-assumptions.md).

## Local setup

Use Node.js 22.12 or newer in the 22 LTS line. Run `npm ci` to install the locked dependencies. The local database checks need no credentials, Docker, Supabase account or running web server.

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

Each command creates a fresh in-memory PostgreSQL database with PGlite, applies the migrations, and closes it when finished. Tests/seed validation add fictional identities and records; type generation needs only the schema. No data survives the command and no hosted project is changed. Tests exercise database constraints and RLS with a local identity adapter, not real Supabase JWT verification.

For the placeholder web app, run `npm run dev` and open http://localhost:3000. Login and CRM forms are not implemented, and the web app does not display the local test database. Copy `.env.example` to `.env.local` only when configuring the later Supabase integration.

## Structure

- `src/app`: pages, dashboard shell and API stubs.
- `src/components`: reusable UI organized by module.
- `src/features`: validation, queries and business services.
- `src/lib`: database, authorization, cache and formatting helpers.
- `supabase`: executable schema, RLS, trigger/index migrations and fictional local seed.
- `docs`: technical documentation and editable Mermaid diagrams.
- `tests/unit`: PostgreSQL-backed database checks; browser E2E files remain placeholders.
- `scripts/lib/local-database.ts`: isolated local Auth adapter and migration runner; never deploy its Auth bootstrap.

Next.js 16 uses `src/proxy.ts` instead of `src/middleware.ts`. Tailwind CSS 4 uses its PostCSS plugin and CSS configuration. `components.json` reserves component aliases; no shadcn components have been generated. Empty planned directories use `.gitkeep`.

## Commands

- `npm run dev`: local development.
- `npm run lint`: ESLint.
- `npm run typecheck`: TypeScript.
- `npm run build`: production build.
- `npm test`: run 43 database checks for constraints, access, auditing and fixed targets.
- `npm run test:e2e`: requires tests, browser installation, a running server and demo accounts.
- `npm run validate:seed`: apply migrations and fictional seed, then verify financial totals, target reconciliation and basic visibility.
- `npm run db:types`: regenerate TypeScript types by inspecting the migrated local database catalog.
- `npm run db:types:check`: fail if generated types no longer match migrations.

## Current status

Implemented locally: 13 tables, database constraints, RLS, immutable audit history, fictional seed, generated database types and transactional target approval with locked baselines. Quarter totals and the employee/vertical allocation grid reconcile before approval. Realized contributions are separate from forecasts, budgets and activity recognition estimates; currencies are never automatically converted.

Pending: Supabase project integration, real authentication/session refresh, server authorization/services, CRM screens, reporting, caching and deployment. Dashboard pages are public placeholders and must not contain private data until request access controls are implemented. API stubs return HTTP 501. No real donor data, passwords or secrets are included.

The [database schema](docs/03-database-schema.md) describes the current storage model. Forecast values must remain separate from recognized achievement; pipeline stages and target verticals remain configurable and provisional.

The requirements register distinguishes confirmed Word-assessment requirements from proposed technical choices and unverified recruitment email requirements. It includes company primary/secondary contact details, optional operational budgets, independent activity context/remaining work, contacts-engaged reporting and manual in-kind valuation supplied by the operational team. These application workflows remain pending implementation.

Database tests, seed validation, generated-type consistency, lint, typecheck and production build passed locally. See [verification details](docs/07-testing-and-limitations.md) and the [local test guide](docs/06-user-guide.md). Next checkpoint: connect Supabase Auth and protect routes, then implement Contacts CRUD.
