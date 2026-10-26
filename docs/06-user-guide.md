# User guide

## Test the database foundation locally

Open a terminal in the project folder using Node.js 22.12 or newer in the 22 LTS line. On a fresh checkout, run `npm ci` first. No environment variables, Docker, Supabase account or web server are required for these commands:

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

- `npm test` runs 418 checks covering database/authentication foundations, Contacts/Opportunities/Meetings/Activities persistence/deletion, linked follow-up integrity under PostgreSQL/RLS, service/API/query contracts, forms and demo-seed preparation. These tests require no live account or hosted writes. Completed results are recorded in [testing and limitations](07-testing-and-limitations.md).
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

The hosted project needs all six migrations applied, a confirmed email/password Auth user and a matching `public.profiles` row with the same UUID, department `PSE`, `active = true`, and role `pse_member`, `pse_manager` or `admin`. Profiles are provisioned through trusted administration; there is no self-service CRM signup. The local seed's fixed identity rows are not hosted login accounts.

Run `npm run dev`, open http://localhost:3000/login and sign in using the email/password of your Supabase Auth user. Successful PSE access opens `/dashboard`; the header shows the profile name, role and Sign out button. Contacts, Opportunities, Meetings with follow-ups, Activities and pipeline Settings are implemented. Target/contribution-entry screens and reporting remain pending. The disposable local seed is not connected to the web app.

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
npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts
```

Playwright starts the app on http://127.0.0.1:3100 automatically. If `npm run dev` is already running in this workspace, reuse it from the test terminal:

```powershell
$env:E2E_BASE_URL = 'http://localhost:3000'
npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts
```

Ten anonymous browser checks need configured public Supabase values but no login credentials. Optional live login tests skip unless `.env.local` contains the matching fictional demo credentials:

```text
E2E_PSE_EMAIL=your-demo-user-email
E2E_PSE_PASSWORD=your-demo-user-password
E2E_RESTRICTED_EMAIL=your-restricted-demo-user-email
E2E_RESTRICTED_PASSWORD=your-restricted-demo-user-password
```

Optional `E2E_BASE_URL` targets an already running app instead of starting a local server. Keep demo values private; they are not committed. Live test traces/screenshots are disabled. The contact write workflow also requires `E2E_CONTACT_WRITES=1`; it creates two fictional records, tests blocked company deletion while linked, and deletes its own person/company records on success. It requires migration 0004; interrupted/failed runs can leave fictional records for manual review. Live testing remains explicit opt-in, and the developer has chosen manual authenticated testing. See [verification evidence](07-testing-and-limitations.md) for actual run results rather than treating optional test availability as proof of execution.

## Try Contacts in the browser

1. Open http://localhost:3000/contacts after signing in. Click **New contact** and create an Individual with a name and either email or phone. Company/workplace is optional. Refresh its detail page to check persistence.
2. Create a Company contact with email or phone. Optional fields include website, industry and relationship notes. For a person, select that company through **Company / workplace** by searching existing internal company records.
3. Try submitting a contact without email and phone; field errors should appear. Try an existing email with different case or an existing phone with different punctuation; a duplicate warning should link to the existing contact, and saving should be rejected.
4. Open a contact you created and click **Edit contact**. Change its name or notes, save, and refresh. The contact type remains fixed. An authorized manager can edit colleagues' contacts; an ordinary member can view them but cannot edit them.
5. Use list search, Individual/Company filters, the company/workplace filter and pagination to find records. Search includes name, email, phone, designation and industry; company filtering uses the structured company link. Phone country codes are not inferred, so enter them consistently.
6. Review contact information, plain-text relationship notes and recent linked opportunities/meetings/activities. Meetings and meeting-linked follow-up task creation are implemented; the general Activities workspace supports editing, status changes and deletion. A contact's **Schedule meeting** button opens New meeting with that contact selected. Related histories are intentionally bounded to the recent records shown, with dates in Asia/Dhaka.

Contacts are saved to your configured Supabase project. Use fictional records while testing. The local seed is not imported into the hosted project automatically.

## Delete a contact

Contact deletion needs migration 0004, already applied to the configured hosted project. For another linked project, apply pending migrations:

```powershell
npx.cmd supabase db push --linked
```

Applying deletion policies does not delete any contact or opportunity.

Open a contact's detail page. The creator or an active PSE manager/admin sees **Delete contact** beside **Edit contact**. Click it, review the named contact and permanent-deletion notice, then choose **Cancel** or **Delete permanently**. Cancellation sends no delete request. Success returns to the contact list with a confirmation message.

Contacts referenced by associated people, opportunities (including primary/secondary contacts), meetings or activities cannot be deleted. The dialog displays an explanation; reassign or unlink those records before trying again. No linked records are automatically removed. Audit history, including the delete actor and before snapshot, remains retained. This is an added project feature; contact active/inactive status remains a separate unresolved assessment decision.

## Try Opportunities in the browser

Opportunity creation/editing uses the original schema. Deletion additionally needs migration 0005, already applied to the configured hosted project. All browser saves use your configured Supabase project; use fictional test records.

1. Sign in as an active PSE manager/admin and open **Settings** (`/settings`). Add active stages and contribution categories, or click **Load provisional assessment examples**. That button adds the original eight stages and six categories as provisional examples; it keeps existing configuration. Final stage labels still need PSE confirmation. Ordinary members can view settings but cannot change them.
2. Open **Opportunities → New deal**. Enter a deal name, focal person, category, stage, existing individual/company contact, positive expected amount and currency. Ordinary members create deals for themselves; managers can assign another active PSE employee. Payment interval, closing date, country, description, notes and a separate operational budget are available. Zero-value engagement belongs in Activities.
3. To test inline contact creation, first enter a deal name, amount and notes, then click **Create contact**. Create an individual or company with email or phone. Saving closes the dialog and selects the contact while keeping the deal draft. For a company, select/create a primary individual and optionally a distinct secondary individual; their stored email/phone and the company website appear in the form. Duplicate contact details use the existing warnings/rejections. A saved contact remains in Contacts if you later cancel the deal.
4. Choose **Valued in-kind** to test the required agreed valuation/source note and optional reference URL. Use the operational team's manually supplied estimate; the CRM does not compute market value. Paste Google Drive URLs into Description/Notes or the separate reference field, one per line. There are no direct uploads or external company lookups.
5. Click **Create deal**, refresh its detail page, and verify the saved contact people, expected value, budget and context. Open **Edit deal** and change a field. The focal person, creator or manager may edit; an unrelated PSE colleague can read the deal. Only a manager can reassign its focal person. Existing actuals protect currency/type, and existing linked interactions protect compatible contact relationships.
6. Use **Move to stage** on a deal detail or board card, select a stage and click **Move**. Verify the new stage and **Recent changes** entry after refresh. Moving to Won must leave **Recognized contributions** unchanged. Contribution entry is a later workflow; forecast value is never treated as received funds automatically.
7. Try list filters for deal name, focal person, stage, category, type, currency and expected-closing range. Switch to **Stage board**. Both views show up to 20 deals per page; use Previous/Next for more. Counts per column and expected-value subtotals cover only the displayed page, with each currency shown separately. Closed deals can be included when no stage filter is selected; these figures are not an open-pipeline forecast report.
8. In Settings, rename or deactivate a stage/category and check the result. Existing unchanged inactive selections remain editable, but new/changed selections must be active. Stage positions must be unique; use an unused position when reordering. Configuration changes also have database audit history. If example setup is interrupted, refresh and retry to add missing entries; it does not overwrite entries already present.

The detail view shows the latest 10 actual contribution records and 20 opportunity audit entries, rather than complete totals/history. Stage history uses current stage names. Final stages, secondary-contact requiredness and detailed financial recognition rules still need PSE confirmation. Authenticated hosted browser/PostgREST persistence is a manual acceptance check; automated checks use disposable SQL and mocked transports.

## Delete an opportunity

The configured hosted project already has `0005_opportunity_deletion.sql` applied. On another linked project, run `npx.cmd supabase db push --linked` to apply pending migrations; this grants restricted deletion without deleting data.

For a manual test, create a disposable fictional deal, then open its detail page. The active PSE focal person, creator or manager/admin sees **Delete opportunity** beside **Edit deal**. Click it and verify the dialog names the deal. Choose **Cancel** to keep it without sending a delete request, or **Delete permanently** to remove it and return to the list with a success message. Refresh/search to confirm it is gone; its contacts remain.

Meetings, activities and recognized contributions block deletion with a visible explanation. Related work must be reassigned or unlinked first; recognized contributions are retained and cannot be edited/deleted through the CRM. A closed stage alone does not prevent deletion, but actual contribution history does. Audit snapshots and the deletion actor remain in the database. This is a user-requested addition beyond the assessment's explicit requirements.

## Try Meetings and linked follow-ups

The configured project has all six migrations, including the meeting-delete policy, and six fictional demo meetings. Open `/meetings` and search `Demo |` to browse three Scheduled, two Done and one Cancelled example. Hosted seeding used administrative access; live end-user login/browser behavior remains a manual check. Your browser saves use the configured Supabase project, so use fictional records. Meeting title/owner, Cancelled and deletion are project choices; the assessment lists contact information, event date/time, Scheduled/Done and description.

1. **Create an independent meeting from a contact.** Open an individual contact, such as a fictional independent donor, and click **Schedule meeting**. Enter a title, a future **Meeting date and time (Asia/Dhaka)**, Scheduled status and optional description. Leave opportunity empty. Save, refresh and verify the meeting retains the contact without requiring a company or financial deal. Owner defaults to your account; a manager may assign another active PSE employee.
2. **Create a meeting from an opportunity.** Open a fictional company deal and click **Schedule meeting**. The opportunity is selected. Leave **Contact person / organization** as **Use opportunity contact details** to derive the primary contact (or opportunity party if no primary is set), or explicitly choose its party, primary or secondary contact. Verify the displayed designation, email/phone and workplace. An opportunity-only meeting does not require a duplicate explicit contact link. Internal search also supports selecting existing contacts/deals from **Meetings → New meeting**; external autofill is excluded.
3. **Check editing and completion.** Save the meeting and open **Edit meeting**. Change its description or event time, save and refresh. On detail, choose Done under **Update meeting status** and click **Save status**. Check **Recent changes** for the status transition. The event time stays separate from the audit update time, and no contribution/target achievement is created by completing a meeting. Scheduled/Done are supported throughout; Cancelled is an additional project option.
4. **Create a follow-up task.** In **Linked activities and follow-ups**, enter a next action under **Create a follow-up**, optionally set **Relevant date/time**, and click **Create follow-up task**. It should appear in the linked activity list after refresh as an Open Task. It inherits the saved meeting/contact/opportunity links, preserves a nullable explicit contact, and is assigned to you by default. Managers can select another active task owner. Active PSE colleagues may create their own task on any visible meeting. This flow creates tasks only; open the linked entry in Activities for editing, completion or deletion.
5. **Verify relationships and permissions.** A contact-only meeting can use an individual or company. When choosing an opportunity, an explicit contact must be its party or designated primary/secondary person; incompatible previous contact selections are cleared so you can choose a valid point of contact. Clearing both contact and opportunity is rejected. Existing linked activities may block edits that would contradict their saved relationships. The owner, creator or manager can edit; unrelated PSE colleagues can read. Only a manager can reassign owners. If a second fictional account is available, check these permissions there.
6. **Try the meeting list.** Open `/meetings`, search by title and use owner/status/date filters. **Upcoming scheduled** means Scheduled with event time from now onward; **Completed** means Done, regardless of event date. View and Status combine with AND: for example, Completed plus Scheduled returns no matches. Use All meetings to find overdue Scheduled records. Date bounds include whole Asia/Dhaka calendar days. Lists show 20 rows per page in event-time/ID order; use Previous/Next for more.
7. **Check related navigation.** Contact detail's Recent meetings links open working meeting detail pages. Opportunity detail provides **View meetings**, filtered to its saved opportunity link. A `contact_id` list filter matches an explicit meeting contact only; it does not include every opportunity-only meeting whose display derives that person. Contact detail's recent indirect history remains bounded to its displayed parent records.

Meeting detail shows the latest 20 directly linked activities and 20 audit entries. Owner selection is capped at 1,000 permitted PSE profiles, with historical inactive owners retained on existing records. Contact/organization information is read from current internal contact records rather than a historical snapshot. Activity editing, status and deletion are available through the linked entry; external sync, automatic valuation and follow-up-rate KPI remain excluded as documented. Authenticated hosted persistence and native browser interaction remain manual acceptance checks; the [test log](07-testing-and-limitations.md) records 418 passing checks and twelve passing anonymous browser tests, with three optional live cases skipped.

## Delete a meeting

Open a meeting's detail page. The active PSE owner, creator or authorized manager/admin sees **Delete meeting** beside **Edit meeting**. Review the named meeting in the confirmation dialog. **Cancel** keeps it without a delete request; **Delete permanently** removes it and returns to the list with confirmation. Contacts, opportunities and audit snapshots remain retained. Scheduled, Done and Cancelled meetings can all be deleted when unreferenced.

For a full manual check, use a disposable fictional meeting, cancel once, then confirm deletion and refresh/search to verify it is gone. On another meeting, create a follow-up task and try deletion: the dialog should explain that linked work blocks it. Activities/follow-ups are not automatically removed or unlinked. Open the linked activity to edit/delete it explicitly if appropriate; deleting it keeps the meeting, and can remove that meeting-deletion dependency. Migration 0006 is already applied to this hosted project; another linked project can apply pending migrations with `npx.cmd supabase db push --linked`.

## Next workflow

Implement recognized-contribution entry and target setup/allocation, then dashboard/reporting using confirmed recognition and metric definitions.

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

## Seed demo meetings

Six meeting examples are already inserted for Demo Manager. This separate command previews missing meeting IDs and, with `--apply`, inserts only those meetings:

```powershell
npm.cmd run seed:meetings
npm.cmd run seed:meetings -- --apply
```

It reuses current existing demo contact/opportunity links and the same private administrative connection as `seed:demo`. Names start with `Demo |`. Dates are relative to the Dhaka day of the first insert, with three upcoming Scheduled, two past Done and one Cancelled record. Examples include contact-only, opportunity-only derived contact, and designated company contact links. No contacts, opportunities, activities, targets or actual contributions are inserted/changed. Deleted parents are not recreated; at least one existing demo contact is required. Stable IDs preserve edited meetings on reruns and add any missing examples. Optional `--owner=EXISTING_PSE_PROFILE_UUID` chooses another active PSE account for new inserts.

The hosted insert and joins were verified, and a repeat preview reported six existing meetings and zero missing inserts. This is administrative verification, not a live end-user login test. Ordinary meeting forms continue to use the caller's session/RLS, and a linked follow-up blocks deletion under migration 0006.


## Try Activities

The hosted project has 11 fictional examples owned by Demo Manager, one for each assessment activity type. Sign in as Demo Manager/a manager to edit these examples, or create your own disposable entries for mutation tests. Sign in to the running app, open **Activities**, and search `Demo |`. Try type, work category, status, owner and relevant-date filters; clear date filters to include undated work. Lists show 20 entries per page and the exact matching count. Contact/deal/meeting shortcuts filter direct links only.

1. Choose **New activity**. Select a type and category, enter descriptive notes, optional related person/organization and remaining work. Leave all CRM links and time empty; save and refresh to confirm independent work persists.
2. Create a second fictional entry with a relevant Dhaka date/time. Add optional document URLs or paste Google Drive references into notes. Choose an existing contact, opportunity or meeting using the internal selectors. Choosing a meeting clears previous direct links and displays inherited context; add only compatible direct links if needed.
3. Open the saved entry, choose **Edit activity**, change notes/category/remaining work and save. Change its status to Done using **Save status**. Relevant time does not become a completion timestamp; no financial amount or received contribution is created.
4. From a meeting, create a follow-up task and open it in the linked Activities list. Edit it or mark it Done in the same workspace.
5. On a disposable entry you may edit, select **Delete activity**. Cancel once to check nothing changes, then confirm **Delete permanently**. Refresh/search to check it is gone. Parent contacts/deals/meetings remain; the deletion audit snapshot remains in the database. Deleting a follow-up may unblock deletion of its meeting; it does not delete the meeting itself.
6. With another fictional PSE account, check team visibility and owner/creator/manager edit/delete permissions. Members cannot reassign ownership; managers may assign another active PSE owner. An unrelated member gets read access only. Inactive/non-PSE accounts must be denied.

Activity notes are required as a project data-quality choice; time and all three links are optional. Existing legacy records with blank notes need notes added before a status/detail update. Relevant-date filters exclude undated work. The detail audit list is capped at 20 entries; owner lookup at 1,000 profiles. Contact information reflects current linked records. Full reporting, reminder/calendar integration, Gmail sync, uploads, automatic valuations and unapproved KPIs are not implemented.

To preview or add missing demo activities in another configured project:

```powershell
npm.cmd run seed:activities
npm.cmd run seed:activities -- --apply
npm.cmd run seed:activities
```

Use the same privately configured administrative key as other seed scripts. The script never provisions users, overwrites existing demo edits or recreates deleted parents. It uses current demo contacts/deals/meetings when available and otherwise creates independent examples. Dates are relative to the Dhaka day of first insertion; one general entry is undated. Optional `--owner=EXISTING_PSE_PROFILE_UUID` affects only newly inserted rows. No financial values, targets, contacts, deals or meetings are created/changed. Migration 0007 adds the deletion grant/policy without changing columns; apply pending migrations with `npx.cmd supabase db push --linked` for another project. Hosted demo verification is administrative; live end-user sign-in and native dialog behavior remain manual checks.
