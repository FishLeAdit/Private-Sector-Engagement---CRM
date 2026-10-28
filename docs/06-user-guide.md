# User guide

## Test the database foundation locally

Open a terminal in the project folder using Node.js 22.12 or newer in the 22 LTS line. On a fresh checkout, run `npm ci` first. No environment variables, Docker, Supabase account or web server are required for these commands:

```powershell
npm test
npm run validate:seed
npm run db:types:check
```

- `npm test` runs 618 checks covering database/authentication foundations, Contacts/Opportunities/Meetings/Activities persistence/deletion, linked follow-up integrity under PostgreSQL/RLS, service/API/query contracts, forms, report caching and demo-seed preparation. These tests require no live account or hosted writes. Completed results are recorded in [testing and limitations](07-testing-and-limitations.md).
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

The hosted project needs every migration in `supabase/migrations` applied, a confirmed email/password Auth user and a matching `public.profiles` row with the same UUID, department `PSE`, `active = true`, and role `pse_member`, `pse_manager` or `admin`. Profiles are provisioned through trusted administration; there is no self-service CRM signup. The local seed's fixed identity rows are not hosted login accounts.

Run `npm run dev`, open http://localhost:3000/login and sign in using the email/password of your Supabase Auth user. Successful PSE access opens `/dashboard`; the header shows the profile name, role, a theme switch (dark or light; remembered in this browser) and Sign out. The navigation rail marks the current section; on a phone it opens from the Menu button. Contacts, Opportunities, Meetings with follow-ups, Activities and pipeline Settings are implemented. Contribution entry and target allocation/performance are implemented. Dashboard and Reports show filtered funding and workload metrics with short-lived server snapshots. Permission-scoped caching is implemented; signed-in acceptance and deployment remain later work. The disposable local seed is not connected to the web app.

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

Optional `E2E_BASE_URL` targets an already running app instead of starting a local server. Keep demo values private; they are not committed. Live test traces/screenshots are disabled. The signed-in specs in `tests/e2e/live` also require `E2E_LIVE_WRITES=1`. They create records named "QA …" (contacts, a deal, a meeting and an activity), check edits, a stage move, blocked deletes of linked parents, past-the-end list pages and the target percentage box, then delete everything they created, including after a failure or timeout. Recording a contribution, saving or approving a target plan, and changing verticals, stages or categories cannot be undone, so those requests are blocked in the browser. Live testing remains explicit opt-in. See [verification evidence](07-testing-and-limitations.md) for actual run results rather than treating optional test availability as proof of execution.

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
6. Use **Move to stage** on a deal detail or board card, select a stage and click **Move**. Verify the new stage and **Recent changes** entry after refresh. Moving to Won must leave **Recognized contributions** unchanged. Received support is entered separately with **Record contribution** on the deal; forecast value is never treated as received funds automatically.
7. Try list filters for deal name, focal person, stage, category, type, currency and expected-closing range. Switch to **Stage board**. Both views show up to 20 deals per page; use Previous/Next for more. Counts per column and expected-value subtotals cover only the displayed page, with each currency shown separately. Closed deals can be included when no stage filter is selected; these figures are not an open-pipeline forecast report.
8. In Settings, rename or deactivate a stage/category and check the result. Existing unchanged inactive selections remain editable, but new/changed selections must be active. Stage positions must be unique; use an unused position when reordering. Configuration changes also have database audit history. If example setup is interrupted, refresh and retry to add missing entries; it does not overwrite entries already present.

The detail view shows the latest 10 actual contribution records and 20 opportunity audit entries, rather than complete totals/history. Stage history uses current stage names. Final stages, secondary-contact requiredness and detailed financial recognition rules still need PSE confirmation. Authenticated hosted browser/PostgREST persistence is a manual acceptance check; automated checks use disposable SQL and mocked transports.

## Delete an opportunity

The configured hosted project already has `0005_opportunity_deletion.sql` applied. On another linked project, run `npx.cmd supabase db push --linked` to apply pending migrations; this grants restricted deletion without deleting data.

For a manual test, create a disposable fictional deal, then open its detail page. The active PSE focal person, creator or manager/admin sees **Delete opportunity** beside **Edit deal**. Click it and verify the dialog names the deal. Choose **Cancel** to keep it without sending a delete request, or **Delete permanently** to remove it and return to the list with a success message. Refresh/search to confirm it is gone; its contacts remain.

Meetings, activities and recognized contributions block deletion with a visible explanation. Related work must be reassigned or unlinked first; recognized contributions are retained and cannot be edited/deleted through the CRM. A closed stage alone does not prevent deletion, but actual contribution history does. Audit snapshots and the deletion actor remain in the database. This is a user-requested addition beyond the assessment's explicit requirements.

## Try Meetings and linked follow-ups

The configured project has all eleven migrations, including the meeting-delete policy, and six fictional demo meetings. Open `/meetings` and search `Demo |` to browse three Scheduled, two Done and one Cancelled example. Hosted seeding used administrative access; live end-user login/browser behavior remains a manual check. Your browser saves use the configured Supabase project, so use fictional records. Meeting title/owner, Cancelled and deletion are project choices; the assessment lists contact information, event date/time, Scheduled/Done and description.

1. **Create an independent meeting from a contact.** Open an individual contact, such as a fictional independent donor, and click **Schedule meeting**. Enter a title, a future **Meeting date and time (Asia/Dhaka)**, Scheduled status and optional description. Leave opportunity empty. Save, refresh and verify the meeting retains the contact without requiring a company or financial deal. Owner defaults to your account; a manager may assign another active PSE employee.
2. **Create a meeting from an opportunity.** Open a fictional company deal and click **Schedule meeting**. The opportunity is selected. Leave **Contact person / organization** as **Use opportunity contact details** to derive the primary contact (or opportunity party if no primary is set), or explicitly choose its party, primary or secondary contact. Verify the displayed designation, email/phone and workplace. An opportunity-only meeting does not require a duplicate explicit contact link. Internal search also supports selecting existing contacts/deals from **Meetings → New meeting**; external autofill is excluded.
3. **Check editing and completion.** Save the meeting and open **Edit meeting**. Change its description or event time, save and refresh. On detail, choose Done under **Update meeting status** and click **Save status**. Check **Recent changes** for the status transition. The event time stays separate from the audit update time, and no contribution/target achievement is created by completing a meeting. Scheduled/Done are supported throughout; Cancelled is an additional project option.
4. **Create a follow-up task.** In **Linked activities and follow-ups**, enter a next action under **Create a follow-up**, optionally set **Relevant date/time**, and click **Create follow-up task**. It should appear in the linked activity list after refresh as an Open Task. It inherits the saved meeting/contact/opportunity links, preserves a nullable explicit contact, and is assigned to you by default. Managers can select another active task owner. Active PSE colleagues may create their own task on any visible meeting. This flow creates tasks only; open the linked entry in Activities for editing, completion or deletion.
5. **Verify relationships and permissions.** A contact-only meeting can use an individual or company. When choosing an opportunity, an explicit contact must be its party or designated primary/secondary person; incompatible previous contact selections are cleared so you can choose a valid point of contact. Clearing both contact and opportunity is rejected. Existing linked activities may block edits that would contradict their saved relationships. The owner, creator or manager can edit; unrelated PSE colleagues can read. Only a manager can reassign owners. If a second fictional account is available, check these permissions there.
6. **Try the meeting list.** Open `/meetings`, search by title and use owner/status/date filters. **Upcoming scheduled** means Scheduled with event time from now onward; **Completed** means Done, regardless of event date. View and Status combine with AND: for example, Completed plus Scheduled returns no matches. Use All meetings to find overdue Scheduled records. Date bounds include whole Asia/Dhaka calendar days. Lists show 20 rows per page in event-time/ID order; use Previous/Next for more.
7. **Check related navigation.** Contact detail's Recent meetings links open working meeting detail pages. Opportunity detail provides **View meetings**, filtered to its saved opportunity link. A `contact_id` list filter matches an explicit meeting contact only; it does not include every opportunity-only meeting whose display derives that person. Contact detail's recent indirect history remains bounded to its displayed parent records.

Meeting detail shows the latest 20 directly linked activities and 20 audit entries. Owner selection is capped at 1,000 permitted PSE profiles, with historical inactive owners retained on existing records. Contact/organization information is read from current internal contact records rather than a historical snapshot. Activity editing, status and deletion are available through the linked entry; external sync, automatic valuation and follow-up-rate KPI remain excluded as documented. Authenticated hosted persistence and native browser interaction remain manual acceptance checks; the [test log](07-testing-and-limitations.md) records 618 passing checks and nineteen passing anonymous browser tests, with three optional live cases skipped.

## Delete a meeting

Open a meeting's detail page. The active PSE owner, creator or authorized manager/admin sees **Delete meeting** beside **Edit meeting**. Review the named meeting in the confirmation dialog. **Cancel** keeps it without a delete request; **Delete permanently** removes it and returns to the list with confirmation. Contacts, opportunities and audit snapshots remain retained. Scheduled, Done and Cancelled meetings can all be deleted when unreferenced.

For a full manual check, use a disposable fictional meeting, cancel once, then confirm deletion and refresh/search to verify it is gone. On another meeting, create a follow-up task and try deletion: the dialog should explain that linked work blocks it. Activities/follow-ups are not automatically removed or unlinked. Open the linked activity to edit/delete it explicitly if appropriate; deleting it keeps the meeting, and can remove that meeting-deletion dependency. Migration 0006 is already applied to this hosted project; another linked project can apply pending migrations with `npx.cmd supabase db push --linked`.

## Next workflow

Next: review signed-in report/CRUD acceptance, then caching/performance and deployment. Phase 11 reporting is implemented.

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

1. Choose **New activity**. Select a type and category, enter descriptive notes, a related person or organization; add remaining work if useful. Leave all CRM links and time empty; save and refresh to confirm independent work persists.
2. Create a second fictional entry with a relevant Dhaka date/time. Add optional document URLs or paste Google Drive references into notes. Choose an existing contact, opportunity or meeting using the internal selectors. Choosing a meeting clears previous direct links and displays inherited context; add only compatible direct links if needed.
3. Open the saved entry, choose **Edit activity**, change notes/category/remaining work and save. Change its status to Done using **Save status**. Relevant time does not become a completion timestamp; no financial amount or received contribution is created.
4. From a meeting, create a follow-up task and open it in the linked Activities list. Edit it or mark it Done in the same workspace.
5. On a disposable entry you may edit, select **Delete activity**. Cancel once to check nothing changes, then confirm **Delete permanently**. Refresh/search to check it is gone. Parent contacts/deals/meetings remain; the deletion audit snapshot remains in the database. Deleting a follow-up may unblock deletion of its meeting; it does not delete the meeting itself.
6. With another fictional PSE account, check team visibility and owner/creator/manager edit/delete permissions. Members cannot reassign ownership; managers may assign another active PSE owner. An unrelated member gets read access only. Inactive/non-PSE accounts must be denied.

Activity notes are required as a project data-quality choice. A related person/organization or valid CRM link is also required; time and the three links remain individually optional. Existing legacy records with blank notes need notes added before a status/detail update. Relevant-date filters exclude undated work. The detail audit list is capped at 20 entries; owner lookup at 1,000 profiles. Contact information reflects current linked records. Reminder/calendar integration, Gmail sync, uploads, automatic valuations and unapproved KPIs are not implemented.

To preview or add missing demo activities in another configured project:

```powershell
npm.cmd run seed:activities
npm.cmd run seed:activities -- --apply
npm.cmd run seed:activities
```

Use the same privately configured administrative key as other seed scripts. The script never provisions users, overwrites existing demo edits or recreates deleted parents. It uses current demo contacts/deals/meetings when available and otherwise creates independent examples. Dates are relative to the Dhaka day of first insertion; one general entry is undated. Optional `--owner=EXISTING_PSE_PROFILE_UUID` affects only newly inserted rows. No financial values, targets, contacts, deals or meetings are created/changed. Migration 0007 adds the deletion grant/policy without changing columns; apply pending migrations with `npx.cmd supabase db push --linked` for another project. Hosted demo verification is administrative; live end-user sign-in and native dialog behavior remain manual checks.


## Try Phase 10: contributions and targets

Open **Contributions** or **Targets** from the sidebar. Migration 0008 is applied to the configured hosted project; another project must apply pending migrations with `npx.cmd supabase db push --linked`. The original Phase 10 implementation inserted no receipts/plans. The subsequent requested demo seed now provides the examples below. Financial entries and approved targets are permanent in this release, so use fictional records in your test environment for these mutation checks.

### Target setup as an authorized manager

1. Sign in as an active PSE manager/admin, open **Targets → Configure verticals**, and create/activate the target dimensions you intend to test. Mark sample terminology provisional. Contribution categories and target verticals remain independent; no DSP/VBD/SAC mapping is automatic.
2. Choose **New target plan**, select year/currency and enter the annual target. Example: 1,000 BDT with quarter baselines 150 / 250 / 250 / 350. One plan is allowed per year/currency.
3. Save an incomplete draft. On the detail page, acknowledge the approval statement and attempt approval: missing employee/vertical allocations must prevent locking. An annual/quarter mismatch must also prevent approval.
4. Choose **Edit draft**. Under **Member and vertical allocations**, pick a quarter (Q1–Q4). Each active member has a row: enter the member's amount for that quarter, then split it across the verticals by percentage. The calculated amount appears under each percentage, and the row shows its split total (for example "60% (40% left)"). A member's split must total exactly 100% before the draft can be saved; the save message names any member and quarter that is not finished. Amounts round down to the cent and the member's last vertical takes any leftover cents, so the cells always add up to the member's amount. The line above the grid shows the quarter target, the amount given to members and what is left (or over-allocated); members must add up to the quarter before approval. A saved plan opens with each member's amount and percentages filled in, and rows you do not edit keep their saved amounts exactly. Changing a quarter baseline keeps the members' amounts and updates what is left.
5. Save, review the detail page and approve/lock. The plan now shows approver/time and becomes read-only. Quarterly baselines cannot change to match later actual performance. An ordinary PSE member can read the plan but cannot create, edit, configure or approve it.
6. To check stale-version protection, open a draft in two tabs, save in one, then try saving/approving the older tab. It must report a conflict; reload and review the latest data.

### Record actual support from an opportunity

1. Open a fictional opportunity that is open or won and choose **Record contribution**. Lost, Abandoned and Junk deals do not offer it, and their contribution page explains why; receipts recorded before a deal closed stay counted. Enter the actual amount separately; the opportunity's expected value is deliberately not prefilled. Currency and financial type come from the saved opportunity.
2. Set the recognition date/time in **Asia/Dhaka**, check the attributed employee (a member's own name, fixed; a manager can choose any active employee, starting from the deal's focal person), optionally select an active target vertical, and enter receipt/context or Google Drive references in Notes. Leaving vertical unassigned includes the receipt in team actuals while showing its attribution as unassigned.
3. For valued in-kind support, manually enter the agreed amount and describe the operational-team inventory/market estimate source. Add an inventory/estimate URL if available. An expected opportunity valuation is not automatically recognized.
4. Choose **Review contribution**, check all fields, then **Confirm and record contribution**. The saved detail shows the recorder, recognition time, attribution and supporting context. Reload it to check persistence, and check the opportunity's contribution history. Recording actuals does not move its stage or change expected value.
5. If the connection fails, the form freezes the reviewed snapshot. **Retry same submission** reuses its ID and payload; a successful initial request is returned without adding a second receipt. Check Contributions before starting a separate entry. Append-only receipts have no edit/delete/refund/correction flow in this release.
6. Return to the matching year/currency target plan. Annual, quarter and employee/vertical achievement should reflect the receipt. In a clean fictional example, 165 recognized against a Q1 target of 150 gives 110%; Q2 remains 250. Existing same-year/currency actuals are included too. Unvalued activity records and expected deal values add nothing to achievement.

Target performance uses recognition time in Asia/Dhaka to determine calendar year/quarter, includes all eligible rows through a SQL aggregate, keeps currencies separate and displays unassigned or out-of-allocation receipts rather than dropping them. No allocated target means the percentage is shown as unavailable, rather than dividing by zero. Employee/vertical attribution stays with the receipt after opportunity reassignment. The employee/vertical grid reads in bounded pages to handle more than Supabase's default 1,000-row cap; snapshots above 4,000 allocation cells are not supported. Employee/vertical option lists cap at 1,000 each; recent header audit history at 20 entries. Detailed cell/quarter audit snapshots remain stored in the database.

Live signed-in acceptance is manual. Local SQL, service/API, SDK and form tests verify the behavior above; anonymous browser tests verify protected routes. Phase 12 adds scoped reporting snapshots; refunds/corrections, currency conversion, final vertical mappings and final hierarchy remain outside the implemented scope.


## Browse the seeded finance examples

The configured hosted project now contains:

| Example | What to inspect |
|---|---|
| **2026 · BDT draft plan** | Annual 1,000,000; quarter targets 150,000 / 250,000 / 250,000 / 350,000; 12 employee/vertical cells |
| **Q1 performance** | Cash 100,000 + 65,000 = 165,000, giving 110%; Q2 remains 250,000 |
| **Q2/Q3/Q4 actuals** | 40,000 valued in-kind / 50,000 cash / 25,000 unassigned cash |
| **Annual BDT actuals** | 280,000, or 28% of the 1,000,000 target |
| **Separate USD receipt** | 200 USD on a demo opportunity; excluded from BDT target achievement |
| **2027 · BDT draft plan** | Annual 1,200,000; uneven quarters entered, no employee/vertical cells yet; use Edit draft to practise allocation |

Open **Targets**, then **2026 · BDT**, to view performance. This plan is fully allocated but remains a draft; a manager may review and approve it through the normal UI. The 2027 draft intentionally cannot be approved until its allocations reconcile. Open **Contributions** to inspect all six receipts; Notes begin `Demo |` and clearly identify fictional data. The in-kind entry retains illustrative operational-team agreement and an intentionally fictional Drive URL. Three verticals (`Demo | DSP`, `Demo | VBD`, `Demo | Project`) are active, explicitly provisional examples, not finalized PSE mappings. Receipts/plans are attributed to existing Demo Manager/Demo Member profiles; no users or roles were created. Audit entries identify administrative fixture operations as system actions, not a live user login.

The initial insert and relationships were verified administratively, and a repeat preview found no missing inserts. Seeded target years use free BDT slots rather than overwriting an existing year/currency plan. In this hosted run, those slots were 2026 and 2027. Existing receipt IDs, edited target plans/quarters/cells and configuration remain preserved on reruns; existing plans are skipped entirely, so the seed does not restore cells you deliberately removed. Sample percentages/totals describe the untouched dataset and will reflect subsequent authorized user changes.

```powershell
npm.cmd run seed:finance
npm.cmd run seed:finance -- --apply
npm.cmd run seed:finance
```

Preview is read-only. Apply inserts missing fictional receipt IDs, provisional vertical IDs and new target snapshots. It reuses current existing demo opportunities and needs BDT cash, BDT valued in-kind and USD cash examples; deleted parents are never recreated. An active PSE manager must exist; optional `--owner=EXISTING_PSE_MANAGER_UUID` chooses the fixture creator for new records. Use the same privately configured administrative key as other seed commands. Migration 0009 restricts the atomic target helper to service-role execution; it does not enable an app-side seed button or approve plans. Each new plan is transactional, while vertical/receipt/plan batches are separate retryable steps. A failure can leave previously completed batches present; rerunning adds only missing examples.


## Try Phase 11: Dashboard and Reports

Open [Dashboard](http://localhost:3000/dashboard) or [Reports](http://localhost:3000/reports) after signing in. The hosted project has migrations 0010 and 0011; no business records, receipts, approvals or target baselines were changed to implement reporting. All chart values come from the current database, including the fictional records already seeded.

1. Select **2026 / Full year / Whole team / All verticals / BDT**. With the untouched finance examples, target is 1,000,000 and actual is 280,000 (28%). The target remains labeled Draft until a manager reviews and approves it.
2. Switch to **Q1**: target 150,000, actual 165,000, attainment 110%, overachievement 15,000. Switch to Q2: its target stays 250,000 and actual is 40,000. No carry-forward adjustment changes targets.
3. Select **March**: show monthly actual support while target/attainment remains unavailable. The CRM has no assigned monthly target baseline, so the report does not divide a quarter into invented monthly quotas.
4. Switch to **USD** for the full year: the separate 200 USD receipt appears, with no BDT conversion. Workload counts remain the same because activities/meetings are independent of funding currency.
5. Select a **PSE team member** or **Funding vertical**. Actuals/targets use receipt attribution/allocation cells; pipeline and workload use current record ownership. Vertical affects only funding attribution/targets because no category/workload mapping has been approved. Select **Unassigned contributions** to see support without an allocated vertical target.
6. Review **Pipeline forecast**. It uses current stages for opportunities with expected closing dates in the period. Won remains an expected classification, not a recorded receipt. Opportunities lacking closing dates appear separately and are excluded from period totals.
7. Review **Non-monetary work**. Dated activities, canonical meetings, types/categories/statuses, independent work and monthly trends are separate counts. Undated activities are excluded from period counts and shown separately across all dates for the selected owner. Seeded work dates are mostly in October/November, so Q1 can show financial achievement with no demo work in that quarter.
8. Open **Detailed reports** to inspect the full employee/vertical funding, stage, work-by-owner and monthly tables. A section index (01 Fundraising to 05 Definitions) stays at the top while scrolling.

   The charts follow one rule: the accent colour marks what the chart is about and grey is context.
   - **Fundraising, full-year views:** target against actual for each quarter (the target as an outline, so overachievement shows as the actual rising past it, labelled with its attainment), and the year's cumulative pace. The actual line stops at the current quarter.
   - **Fundraising, every view:** monthly receipts, an attainment meter, and cash versus valued in-kind with each one's share.
   - **Pipeline:** expected value by stage in the configured order, open stages in the accent, plus deals by outcome with Won highlighted.
   - **Workload:** activity types largest first, work categories, activity and meeting status with Done highlighted, and per-month small charts of Done against everything logged.

   Hover a bar or point for its exact value; every chart's values are also in a table for screen readers. Switching between views preserves the filters. Use **Refresh data** to expire your report snapshots and request current data. A normal browser reload can reuse an unexpired server snapshot.

The earlier Activity context gap is closed in client/server validation and SQL. For an independent entry, enter a person or organization without creating a Contact/Opportunity. Alternatively, link a valid existing record. Try saving only Notes with no context/links: it must be rejected. Clearing the last context on edit must also fail. Older context-free rows remain readable and display a notice; add accurate context when editing them. The existing demo general-inbox row may need this correction because the seed preserves earlier rows and edits. No name is fabricated automatically for existing records.

**Contacts engaged** follows the non-monetary section and is labelled provisional: distinct CRM contacts reached by Done meetings and Done activities in the period, by kind, plus named but unlinked interactions; Reports adds a per-owner table. Lead and Follow-up rate KPIs are omitted pending approved definitions. Canonical meetings and Meeting-type activities are never summed as unique interactions. Stage counts are current, not historical snapshots; Done counts use scheduled/relevant dates and current status, not a separately recorded completion date. See [all reporting definitions](09-reporting-definitions.md).

Automated checks cover SQL totals/security/boundaries, read freshness, over 1,000 receipts, API/query contracts, accessible view rendering and anonymous browser redirects. Full signed-in hosted acceptance, chart layout on your devices and cross-session role revocation remain manual checks; optional live login tests stayed disabled as requested.

## Try Phase 12: caching and freshness

No migration or new credential is required. Reports reuse a numeric snapshot for at most 30 seconds; report funding-vertical options for at most five minutes. Current authentication, PSE permissions and profile names are checked on every request. Each cache entry belongs to the verified project, user, role, session and filters. Transactional forms/details and financial validation remain uncached.

1. Sign in, open Reports with fixed filters and note **Updated**. Reload promptly: an unexpired snapshot can retain its timestamp. The page shows minute precision; the report API's `report.generated_at` field gives the exact instant. Bucket boundaries or a refreshed session token can cause an earlier new snapshot.
2. Choose **Refresh data**. After successful invalidation the page requests a new snapshot. Its exact generation time should advance even if totals stay the same; the displayed minute can remain unchanged. A failed request shows an error; retry after restoring access/connectivity.
3. In another signed-in window, make a permitted change to a fictional Activity's status. Reload the matching report: application writes expire affected report snapshots for all project users. Confirm the workload count changes. Restore the demo status afterward if desired. Receipts/target approval are permanent, so use this reversible Activity example for freshness checks.
4. If you edit through trusted Supabase administration or run a seed/import command, use **Refresh data** afterward. Those paths bypass application invalidation. Otherwise report values expire within 30 seconds and vertical options within five minutes.
5. Using a separate fictional account and trusted administration, revoke PSE access after warming its report, then request it again. Access must be denied despite the warm snapshot. Test independent sessions and restore access through administration afterward. These live checks have not been run automatically.

For an uncached comparison, set the server-only `PSE_REPORT_CACHE_ENABLED=false` in your private `.env.local`, restart the development server, and repeat. Remove that override or set it to `true` and restart to enable caching again. No secret value needs to be copied into the browser or shared in chat.

Run the isolated, fictional SQL/cache-policy benchmark without changing hosted data:

```powershell
npm.cmd run benchmark:reports
```

It rewrites [local timing evidence](benchmarks/report-cache.json). The recorded run measured 46.333 ms uncached versus 5.316 ms warm median with 10,002 selected receipts. It uses a measurement cache driver, not Next's production cache storage, and excludes hosted Auth/network, HTTP/rendering and browser time. For actual signed-in HTTP measurements, open DevTools Network and request `/api/reports` with matching query filters; inspect its `Server-Timing` response header before/after repeat requests, with the override enabled/disabled. Keep normal signed-in browser authentication; do not copy bearer tokens into tools or URLs. Compare multiple samples with the same filters/data, accounting for the 30-second bucket boundary.

Shared cache-handler behavior and cross-instance invalidation remain deployment acceptance work. Keep caching disabled on self-hosted replicas until those checks pass. See [cache keys, TTLs and invalidation](05-caching-strategy.md) for the full boundary.
