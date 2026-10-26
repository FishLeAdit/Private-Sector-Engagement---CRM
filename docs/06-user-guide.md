# User guide

## Test the database foundation locally

Open a terminal in the project folder using Node.js 22.12 or newer in the 22 LTS line. On a fresh checkout, run `npm ci` first. No environment variables, Docker, Supabase account or web server are required for these commands:

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

- `npm test` runs 43 checks against PostgreSQL: contact duplicate handling, PSE/non-PSE access, fixed target approval, audit integrity, financial separation and linked/independent records.
- `npm run validate:seed` applies migrations and fictional data to a fresh local database. It checks the 1,000,000 BDT annual allocation, Q1 at 110%, unchanged Q2 target, 205,000 BDT and 200 USD realized totals reported separately, independent activities and basic access restrictions.
- `npm run db:types:check` verifies that committed TypeScript types match the locally migrated database catalog. After an intentional schema change, run `npm run db:types` to regenerate them, then rerun the checks.

Each command uses a disposable in-memory database and closes it afterward. Changing the fictional seed and rerunning validation is safe for local experimentation; expected totals in validation/tests must reflect intentional changes. Nothing is applied to a hosted Supabase project.

To inspect individual cases, open [contacts tests](../tests/unit/contacts.test.ts), [target tests](../tests/unit/targets.test.ts) and [financial integrity tests](../tests/unit/achievements.test.ts). To run only the contacts checks, use `npm test -- tests/unit/contacts.test.ts`.

Additional framework checks:

```powershell
npm run lint
npm run typecheck
npm run build
```

The local identity adapter supplies database roles and request IDs solely for policy testing. It does not validate real JWTs or create Supabase login accounts.

## Preview the web scaffold

Run `npm run dev`, then open http://localhost:3000. The root page opens the sign-in placeholder. `/dashboard` shows the navigation shell; dashboard routes contain placeholder content. The seed database is not connected to this web app, so contacts and financial records will not appear in the browser yet.

## Next usable workflow

Configure a Supabase project and trusted PSE profiles, implement real Auth sessions and protected routes, then implement contact create/edit/search with database-backed validation. Environment keys belong in `.env.local`, using `.env.example` as the starting point. Browser end-to-end testing follows once login and working forms exist.
