# User guide

## Test the database foundation locally

Open a terminal in the project folder using Node.js 22.12 or newer in the 22 LTS line. On a fresh checkout, run `npm ci` first. No environment variables, Docker, Supabase account or web server are required for these commands:

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

- `npm test` runs 88 checks: 43 PostgreSQL checks plus 45 mocked authentication, action, redirect, role and cookie checks. These tests require no live account.
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

## Sign in to the web app

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using your configured Supabase project. `.env.example` contains placeholders; ordinary login does not need a service-role key. Restart the development server after changing environment values.

The hosted project needs the three migrations applied, a confirmed email/password Auth user and a matching `public.profiles` row with the same UUID, department `PSE`, `active = true`, and role `pse_member`, `pse_manager` or `admin`. Profiles are provisioned through trusted administration; there is no self-service CRM signup. The local seed's fixed identity rows are not hosted login accounts.

Run `npm run dev`, open http://localhost:3000/login and sign in using the email/password of your Supabase Auth user. Successful PSE access opens `/dashboard`; the header shows the profile name, role and Sign out button. Business pages remain placeholders, and the disposable local seed is not connected to the web app.

Manual acceptance checks:

1. In a private browser window, open `/dashboard` or `/contacts/new`. Expect a redirect to login; `/api/contacts` should return JSON HTTP 401.
2. Sign in as an active PSE member or manager. Expect the workspace header and navigation. Refresh to confirm the session persists. `/api/contacts` should return HTTP 501 because the Contacts service is the next checkpoint.
3. Click Sign out. Expect `/login`, then verify `/dashboard` requires sign-in again.
4. Try a confirmed Auth user without active PSE membership. Expect an access message and no workspace. An existing authenticated restricted session is directed to `/access-denied`.
5. For profile deactivation testing, use a separate fictional account and trusted administration to set its profile inactive. Refresh an existing authenticated page or request an API; access should be denied. Restore the profile through administration afterward.
6. Check expiry/refresh with the selected Supabase project's session settings; no expired-session test against a live account has been claimed as run here.

If sign-in fails, confirm the Auth account's email/password and confirmation status, then the profile UUID/department/active flag. A temporarily unavailable message indicates configuration or Auth/profile access could not be verified; no access is granted in that state.

## Browser checks

```powershell
npx playwright install chromium
npm run test:e2e -- sign-in.spec.ts
```

Playwright starts the app on http://127.0.0.1:3100 automatically. Four anonymous tests need the configured public Supabase values but no login credentials. Two optional live tests skip unless `.env.local` contains the matching fictional demo credentials:

```text
E2E_PSE_EMAIL=your-demo-user-email
E2E_PSE_PASSWORD=your-demo-user-password
E2E_RESTRICTED_EMAIL=your-restricted-demo-user-email
E2E_RESTRICTED_PASSWORD=your-restricted-demo-user-password
```

Optional `E2E_BASE_URL` targets an already running app instead of starting a local server. Keep demo values private; they are not committed. Live test traces/screenshots are disabled. The developer chose manual live-account testing for this checkpoint; automatic live cases were skipped.

## Next usable CRM workflow

Implement contact create/edit/search with shared validation, authorized services and duplicate warnings. Add full browser CRUD tests once those forms and services exist.
