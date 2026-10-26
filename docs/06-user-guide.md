# User guide

## Test the database foundation locally

Open a terminal in the project folder using Node.js 22.12 or newer in the 22 LTS line. On a fresh checkout, run `npm ci` first. No environment variables, Docker, Supabase account or web server are required for these commands:

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

- `npm test` runs 206 checks: database/authentication foundations plus Contacts/Opportunities persistence under PostgreSQL/RLS, API contracts, query construction, forms, inline contact creation, stage changes, deletion confirmation and hosted demo-seed preparation. These tests require no live account or hosted writes.
- `npm run validate:seed` applies migrations and fictional data to a fresh local database. It checks the 1,000,000 BDT annual allocation, Q1 at 110%, unchanged Q2 target, 205,000 BDT and 200 USD realized totals reported separately, independent activities and basic access restrictions.
- `npm run db:types:check` verifies that committed TypeScript types match the locally migrated database catalog. After an intentional schema change, run `npm run db:types` to regenerate them, then rerun the checks.

Database checks use disposable in-memory databases; API/form checks use mocked transports. Changing the fictional seed and rerunning validation is safe for local experimentation; expected totals in validation/tests must reflect intentional changes. Nothing is applied to a hosted Supabase project by these commands.

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

The hosted project needs all four migrations applied, a confirmed email/password Auth user and a matching `public.profiles` row with the same UUID, department `PSE`, `active = true`, and role `pse_member`, `pse_manager` or `admin`. Profiles are provisioned through trusted administration; there is no self-service CRM signup. The local seed's fixed identity rows are not hosted login accounts.

Run `npm run dev`, open http://localhost:3000/login and sign in using the email/password of your Supabase Auth user. Successful PSE access opens `/dashboard`; the header shows the profile name, role and Sign out button. Contacts, Opportunities and pipeline Settings are implemented; other workflow screens remain placeholders. The disposable local seed is not connected to the web app.

Manual acceptance checks:

1. In a private browser window, open `/dashboard` or `/contacts/new`. Expect a redirect to login; `/api/contacts` should return JSON HTTP 401.
2. Sign in as an active PSE member or manager. Expect the workspace header and navigation. Refresh to confirm the session persists. `/api/contacts` should return HTTP 200 with a contact list/count; it can be empty before you add records.
3. Click Sign out. Expect `/login`, then verify `/dashboard` requires sign-in again.
4. Try a confirmed Auth user without active PSE membership. Expect an access message and no workspace. An existing authenticated restricted session is directed to `/access-denied`.
5. For profile deactivation testing, use a separate fictional account and trusted administration to set its profile inactive. Refresh an existing authenticated page or request an API; access should be denied. Restore the profile through administration afterward.
6. Check expiry/refresh with the selected Supabase project's session settings; no expired-session test against a live account has been claimed as run here.

If sign-in fails, confirm the Auth account's email/password and confirmation status, then the profile UUID/department/active flag. A temporarily unavailable message indicates configuration or Auth/profile access could not be verified; no access is granted in that state.

## Browser checks

```powershell
npx playwright install chromium
npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts
```

Playwright starts the app on http://127.0.0.1:3100 automatically. If `npm run dev` is already running in this workspace, reuse it from the test terminal:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts
```

Eight anonymous tests need configured public Supabase values but no login credentials. Two optional live login tests skip unless `.env.local` contains the matching fictional demo credentials:

```text
E2E_PSE_EMAIL=your-demo-user-email
E2E_PSE_PASSWORD=your-demo-user-password
E2E_RESTRICTED_EMAIL=your-restricted-demo-user-email
E2E_RESTRICTED_PASSWORD=your-restricted-demo-user-password
```

Optional `E2E_BASE_URL` targets an already running app instead of starting a local server. Keep demo values private; they are not committed. Live test traces/screenshots are disabled. The contact write workflow also requires `E2E_CONTACT_WRITES=1`; it creates two fictional records, tests blocked company deletion while linked, and deletes its own person/company records on success. It requires migration 0004; interrupted/failed runs can leave fictional records for manual review. This is an explicit opt-in, not part of the anonymous checks. All three live cases were skipped for this checkpoint.

## Try Contacts in the browser

1. Open http://localhost:3000/contacts after signing in. Click **New contact** and create an Individual with a name and either email or phone. Company/workplace is optional. Refresh its detail page to check persistence.
2. Create a Company contact with email or phone. Optional fields include website, industry and relationship notes. For a person, select that company through **Company / workplace** by searching existing internal company records.
3. Try submitting a contact without email and phone; field errors should appear. Try an existing email with different case or an existing phone with different punctuation; a duplicate warning should link to the existing contact, and saving should be rejected.
4. Open a contact you created and click **Edit contact**. Change its name or notes, save, and refresh. The contact type remains fixed. An authorized manager can edit colleagues' contacts; an ordinary member can view them but cannot edit them.
5. Use list search, Individual/Company filters, the company/workplace filter and pagination to find records. Search includes name, email, phone, designation and industry; company filtering uses the structured company link. Phone country codes are not inferred, so enter them consistently.
6. Review contact information, plain-text relationship notes and recent linked opportunities/meetings/activities. Opportunity creation is implemented; meeting/activity creation is a later checkpoint. Related histories are intentionally bounded to the recent records shown, with dates in Asia/Dhaka.

Contacts are saved to your configured Supabase project. Use fictional records while testing. The local seed is not imported into the hosted project automatically.

## Delete a contact

First apply the new contact-deletion policy to the linked Supabase project:

```powershell
npx supabase db push
```

This applies `0004_contact_deletion.sql`; it does not delete any contact. No hosted migration/deletion was performed by the agent for this checkpoint.

Open a contact's detail page. The creator or an active PSE manager/admin sees **Delete contact** beside **Edit contact**. Click it, review the named contact and permanent-deletion notice, then choose **Cancel** or **Delete permanently**. Cancellation sends no delete request. Success returns to the contact list with a confirmation message.

Contacts referenced by associated people, opportunities (including primary/secondary contacts), meetings or activities cannot be deleted. The dialog displays an explanation; reassign or unlink those records before trying again. No linked records are automatically removed. Audit history, including the delete actor and before snapshot, remains retained. This is an added project feature; contact active/inactive status remains a separate unresolved assessment decision.

## Try Opportunities in the browser

No new migration is needed for this workflow if the existing four migrations are applied. All browser saves use your configured Supabase project; use fictional test records.

1. Sign in as an active PSE manager/admin and open **Settings** (`/settings`). Add active stages and contribution categories, or click **Load provisional assessment examples**. That button adds the original eight stages and six categories as provisional examples; it keeps existing configuration. Final stage labels still need PSE confirmation. Ordinary members can view settings but cannot change them.
2. Open **Opportunities → New deal**. Enter a deal name, focal person, category, stage, existing individual/company contact, positive expected amount and currency. Ordinary members create deals for themselves; managers can assign another active PSE employee. Payment interval, closing date, country, description, notes and a separate operational budget are available. Zero-value engagement belongs in Activities.
3. To test inline contact creation, first enter a deal name, amount and notes, then click **Create contact**. Create an individual or company with email or phone. Saving closes the dialog and selects the contact while keeping the deal draft. For a company, select/create a primary individual and optionally a distinct secondary individual; their stored email/phone and the company website appear in the form. Duplicate contact details use the existing warnings/rejections. A saved contact remains in Contacts if you later cancel the deal.
4. Choose **Valued in-kind** to test the required agreed valuation/source note and optional reference URL. Use the operational team's manually supplied estimate; the CRM does not compute market value. Paste Google Drive URLs into Description/Notes or the separate reference field, one per line. There are no direct uploads or external company lookups.
5. Click **Create deal**, refresh its detail page, and verify the saved contact people, expected value, budget and context. Open **Edit deal** and change a field. The focal person, creator or manager may edit; an unrelated PSE colleague can read the deal. Only a manager can reassign its focal person. Existing actuals protect currency/type, and existing linked interactions protect compatible contact relationships.
6. Use **Move to stage** on a deal detail or board card, select a stage and click **Move**. Verify the new stage and **Recent changes** entry after refresh. Moving to Won must leave **Recognized contributions** unchanged. Contribution entry is a later workflow; forecast value is never treated as received funds automatically.
7. Try list filters for deal name, focal person, stage, category, type, currency and expected-closing range. Switch to **Stage board**. Both views show up to 20 deals per page; use Previous/Next for more. Counts per column and expected-value subtotals cover only the displayed page, with each currency shown separately. Closed deals can be included when no stage filter is selected; these figures are not an open-pipeline forecast report.
8. In Settings, rename or deactivate a stage/category and check the result. Existing unchanged inactive selections remain editable, but new/changed selections must be active. Stage positions must be unique; use an unused position when reordering. Configuration changes also have database audit history. If example setup is interrupted, refresh and retry to add missing entries; it does not overwrite entries already present.

The detail view shows the latest 10 actual contribution records and 20 opportunity audit entries, rather than complete totals/history. Stage history uses current stage names. Final stages, secondary-contact requiredness and detailed financial recognition rules still need PSE confirmation. Authenticated hosted browser/PostgREST persistence is a manual acceptance check; automated checks use disposable SQL and mocked transports.

## Next workflow

Implement Meetings and linked follow-up Activities, preserving contact/opportunity relationships and PSE-wide visibility.

## Add demo data to the web app

The `supabase/seed.sql` dataset is for disposable local tests. To populate the Supabase project actually used by the web app, use the separate administrative seed:

```powershell
npm.cmd run seed:demo
npm.cmd run seed:demo -- --apply
```

The first command previews the plan without writes; the second adds missing demo rows. Use `npm.cmd` in Windows PowerShell to ensure `--apply` reaches the script. The output must show `"mode": "apply"` for writes; `"mode": "preview"` is read-only. Configure `NEXT_PUBLIC_SUPABASE_URL` and the server-side `SUPABASE_SERVICE_ROLE_KEY` privately in `.env.local`. The key may be a Supabase secret key or legacy service_role key. Ordinary app login does not need it; never put it in a `NEXT_PUBLIC_` variable or commit it. No login password is required for this administrative command.

The dataset contains 3 fictional companies, 6 associated people, 2 independent individuals and 8 financial opportunities. Names start with `Demo |`; notes identify the dataset. Sample email/web addresses use `example.invalid`. Sample phones use NANPA's [fictional-number range](https://nanpa.com/numbering/555-line-numbers). Deals include cash and manually valued in-kind examples, BDT and USD, optional operational budgets, and stage/closing-date variation. No received contributions, targets, meetings or activities are inserted, so a Won example still has no actual achievement.

An existing active PSE manager/admin is preferred as owner/creator, falling back to an active member. To choose a particular existing account, pass its profile UUID:

```powershell
npm.cmd run seed:demo -- --apply --owner=EXISTING_PSE_PROFILE_UUID
```

The seed creates no Auth identities and changes no profile/role. It reuses active pipeline configuration; only an entirely empty stage/category table receives provisional assessment examples. Existing but inactive configuration must be activated in Settings first. Where configured labels/categories differ from the examples, the seed uses available active selections without overwriting them or inferring target-vertical mappings.

Deterministic demo IDs and insert-only conflict handling preserve existing and edited records on reruns. Existing email/phone conflicts with a different contact stop the preflight before any writes. Requests run in company → person → opportunity order and are not one transaction; a failed run can leave partial demo rows, and rerunning adds missing rows. This CLI uses administrative access, with an existing employee assigned as creator/owner; hosted audit entries identify the database operation as system-originated rather than an interactive user session.

After a successful run, refresh `/contacts` and `/opportunities`; search `Demo |` or open Stage board. This is a hosted insert operation, unlike `validate:seed`. End-user authentication/RLS/browser acceptance remains a separate manual check.

The initial hosted run completed on 26 October 2026, assigning the 19 demo records to the existing Demo Manager. Contact/stage/category joins were verified through hosted PostgREST; a subsequent preview reported 11 existing contacts, 8 existing opportunities and zero missing inserts. Refresh the app to browse them.
