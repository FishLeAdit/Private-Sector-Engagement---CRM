# Testing and limitations

The database foundation, authentication, Contacts, financial Opportunities, Meetings with linked follow-up tasks, the full Activities workspace, contribution entry and target allocation/performance are implemented. Dashboard and detailed reports are implemented. Evidence below distinguishes PostgreSQL/service tests, mocked transports/form tests, anonymous browser checks and hosted verification that remains manual.

## UI redesign, module pages and QA (U4–U5), on 28 October 2026

The last two phases of the UI redesign: the module pages in the avionics style, then a QA pass across the app. No behaviour, labels or roles changed.

- **Boxes and notices.** A reviewed mechanical pass across 39 files turned the repeated bordered boxes into `.panel` surfaces and the tinted notices into edge-toned strips, and removed shadows. Floating listboxes keep their box, and deal board cards keep plain borders inside their column panels.
- **Status pips.** Meeting, activity and deal-stage states are pips with labels (`components/ui/record-status.tsx`): cyan while active, grey once settled, never blinking in tables.
- **Headings.** Every page heading carries a system string from real context: the record count on lists, the record ID prefix on detail pages, NEW or EDIT on forms. Contact kind badges are small mono tags.
- **Fixed during review:** on detail pages the system string first landed between the status line and the title, so it now leads the header block.

| Check | Result |
|---|---|
| `npm test` | 706 passed across 54 files |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 27 passed in 5.5 min |
| Signed-in screenshots of all 24 routes (dashboard, reports, every list, detail and form page, the board, targets, verticals and settings), dark and light at 1440 px and dark at 390 px | 72 screenshots taken and a representative set reviewed. No route scrolls sideways at any width |
| Keyboard focus and motion, login page | The focused field shows a solid 2px light outline. Under `prefers-reduced-motion` the pip animation drops to one 0.01 ms run, so nothing blinks |
| Contrast | `design-tokens.test.ts` (30 checks) passes for both themes |
| Hosted demo after the runs | No QA records; still 7 contributions |

## UI redesign, overview dashboard (U3), on 28 October 2026

The home dashboard is no longer a copy of Reports. It is an overview of the whole PSE team for the chosen year, quarter or month, with the user's own queue at the end:

- **Status strip:** record counts.
- **Monetary lens:** the one hero figure (actual achievement, with its currency as a small unit so it stays on one line) with target, attainment meter, remaining and overachieved amounts; the year pace chart (monthly receipts outside full-year views); compact pipeline by stage; pipeline, won, cash and in-kind readouts.
- **Non-monetary lens:** work volume, the top five activity types, meeting status, and the provisional contacts engaged.
- **Queue:** the user's next five meetings and open activities, recent contributions, and open deals closing in 30 days, each linked to its full filtered list.

`features/overview/context.ts` reads every panel through the owning module's service, so access rules are unchanged. The report is required; each queue panel fails on its own and says so. Reports became reports-only, and each page links to the other for the same year, period and currency.

| Check | Result |
|---|---|
| `npm test` | 706 passed across 54 files. Added `overview-view.test.tsx`: lens and queue headings, the hero figure read as one amount, pace or monthly fallback, five rows with the full count and a filtered link, a failed panel contained while the others render, the Reports link carrying only year/period/currency, and Dhaka dates crossing the UTC day. Report view tests now cover Reports only |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 27 passed in 4.8 min, including the new read-only `live/overview.spec.ts` (lenses and queue panels present, a chosen quarter carried into Reports, theme kept across a reload) |
| Signed-in screenshots of the dashboard (2026 and Q4) in both themes at 1440 px and at 390 px | Reviewed. The hero figure wrapped, so its currency now sits as a small unit beside the number. No page scrolls sideways |
| Hosted demo after the runs | No QA records; still 7 contributions |

Known limitation: "Deals closing in 30 days" comes from the deals list's first page (the 20 most recently created deals in the window), filtered to open stages and sorted by closing date. With more than 20 deals in a 30-day window it could miss an earlier one; the panel's View all link opens the complete list.

## UI redesign, charts and Reports (U2), on 28 October 2026

Second phase of the UI redesign: a chart kit on recharts (now used, closing C4's "use recharts or remove it") and a rebuilt Reports page. Presentation follows the dataviz rules:

- **Form.** One axis per chart. Accent for what the chart is about, grey for context; categorical colours were rejected after the validator failed blue against violet (13.5 normal-vision, 5.7 protan). Accent against grey passes in both themes (CVD 16.8 dark, 16.6 light).
- **Marks.** Thin bars and lines with square ends; a legend only for two or more series; values in tooltips and in a visually hidden table on every chart. Big numbers use proportional figures.
- **New figures.** Quarter target-vs-actual and year-pace charts for full-year views. Their targets come from the plan through the targets service, following the report's own target rule, so no migration was needed; if the plan can't be read, the charts show actuals only.
- **Sections.** Pipeline by stage in configured order, outcomes with Won highlighted, and workload breakdowns with Done highlighted, plus small monthly charts. A sticky section index on Reports. The old progress-bar component is removed.

| Check | Result |
|---|---|
| `npm test` | 700 passed across 53 files. Added: `report-quarters.test.ts` (baselines vs filtered cells, unassigned, future quarters, cumulative stops), `chart-frame.test.tsx` (named figure, hidden plot mirrored in a table, legend only for 2+ series, empty state) and Reports view tests (quarter and pace values readable per row, the section index on Reports only, outcomes readable) |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 26 passed in 4.6 min |
| Signed-in screenshots of Reports (2026 and Q1) and the dashboard, dark and light at 1440 px and dark at 390 px | Reviewed against the anti-pattern list. Fixed during review: stage and activity names wrapping or clipping on the axis (now single-line, shortened only on the axis), tip labels wrapping on long bars, the cash readout wrapping, and the hidden tables widening the page by 113 px at 390 px (a table ignores `sr-only`'s width, so a clipped box now wraps it). No page scrolls sideways afterwards |
| Charts against hosted data | Q1 shows the actual past its outlined 150,000 target at 110%; the other quarters and the pace lines match the plan and receipts |
| Hosted demo after the runs | No QA records; still 7 contributions |

## UI redesign, foundation (U1), on 28 October 2026

First phase of the UI redesign the user requested: an avionics style in dark and light themes. What changed:

- **Themes.** Two daisyUI themes, `avionics-dark` (default) and `avionics-light`, with square corners, 1px borders and no shadows. Fonts are Inter and JetBrains Mono through `next/font`.
- **Shared pieces.** HUD primitives (`components/ui/hud.tsx`), a theme toggle remembered in a cookie, and a navigation rail that marks the current section and folds behind a Menu button on phones (part of C4).
- **Pages.** The login, access-denied and workspace-error pages are restyled. Module pages pick up the themes without markup changes; their layouts follow in U4.

No behaviour, labels or roles changed.

| Check | Result |
|---|---|
| `npm test` | 690 passed across 51 files; 30 added in `design-tokens.test.ts`, which reads both themes from `globals.css` and checks WCAG contrast (text and small metadata 4.5:1 on the page, raised and panel surfaces; status text 4.5:1; button text 4.5:1; focus ring and decorative strings 3:1). Its first run caught two light-theme values, amber `#B45309` at 4.4:1 and decorative grey `#94A3B8` at 2.3:1, now `#92400E` and `#64748B` |
| `npm run lint`, `npm run typecheck`, `npm run build` (downloads the fonts), `validate:seed`, `db:types:check` | Passed |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 26 passed in 4.8 min. The typography is global, so this confirms every label, role and accessible name the specs use is unchanged |
| Signed-in screenshots of login, dashboard, contacts, deals and the target grid, dark and light at 1440 px and dark at 390 px | Reviewed. The phone header took four rows, so the system string and session pip now hide below the `sm` breakpoint |
| Theme toggle and phone menu, signed in at 390 px | Dark → light → reload stays light → back to dark. The menu opens the rail with the current page marked |
| Hosted demo after the runs | No QA records; still 7 contributions |

## Contacts engaged, provisional, on 28 October 2026

Assessment page 10 lists contacts engaged for the non-monetary lens. It is now built with a provisional definition, labelled "Provisional — awaiting PSE definition" (full rule in [reporting definitions](09-reporting-definitions.md)).

- **Migration 0014** redefines `pse_report` with an `engagement` object: distinct CRM contacts reached by Done meetings and Done activities in the period, by kind and by owner, plus named but unlinked interactions. Apart from that object and its two supporting query parts, the function matches 0011.
- **Dashboard and Reports** show a new section after the non-monetary work; Reports adds a per-owner table.
- **Older snapshots.** A snapshot without the figures (before 0014, or cached from before it) hides the section rather than showing zeros.
- **Report cache.** It removes the new owner names before storing a snapshot and fills them in fresh on each request, like the other owner names. The first full run caught this: the existing "never stores profile names" test failed until the cache handled the new field.

| Check | Result |
|---|---|
| `npm test` | 660 passed across 50 files. Added: a PGlite test (one person reached four ways and a company once count as 2, with Scheduled, cancelled and open work excluded and one named unlinked interaction; owner, month and vertical filters), the same test failing with 0014 removed, view tests (provisional section, owner table, hidden for older snapshots) and cache tests (names neither stored nor stale; older snapshots pass through unchanged) |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed; generated types unchanged |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 26 passed in 4.6 min |
| Signed-in, read-only, development server against the hosted demo (0014 not yet applied there) | Dashboard and Reports render with the section hidden, no error panel and no console error |

After the user applied 0012–0014 to the hosted project (`supabase db push`) and deployed `main` (b8e3925), the live checks were:

| Check | Result |
|---|---|
| Dashboard and Reports, 2026, signed in, on the development server and the Vercel deployment | The section shows 3 contacts engaged (3 individuals, 0 companies, 0 named unlinked interactions), with Demo Manager at 3 in the owner table; no error panel or console error |
| Independent recount from the meetings, activities and deal APIs, applying the documented rule outside SQL | 2 Done meetings and 3 Done activities in 2026 reach 3 distinct contacts, matching the report |
| Playwright against the deployment, both accounts, live-write specs off | 21 passed, 5 skipped (the opt-in write specs) |

The first production Dashboard request still showed no section; a minute later both pages did. That fits the request reaching the previous deployment during the switch, since report caching is off on Vercel.

## Target allocation grid on 28 October 2026

Assessment pages 6 and 9 (steps 4–6) ask for quarterly targets allocated across team members, then by vertical, "preferably percentage-based". The target form's one-row-per-cell list is replaced by a grid. For each quarter, a manager enters each member's amount and splits it across the verticals by percentage (decided 28 October 2026: percentages are shares of the member's amount).

- Calculated amounts round down to the cent, and the member's last vertical takes the leftover cents, so a member's cells always equal their amount (`splitAmount` in `src/lib/money.ts`).
- Saving is blocked, with a message naming the quarter and member, while an entered amount has a split that does not total 100%, or percentages are entered without an amount. Drafts may still leave a quarter partly unallocated; approval enforces reconciliation as before.
- Storage is unchanged: the same employee × vertical cells and `save_target_draft`. A saved plan opens with each member's amount and derived percentages, and rows that are not edited keep their saved cells exactly, even where two-decimal percentages cannot express them.
- Inactive members and verticals appear only while a saved share uses them. Members whose display names are identical cannot be told apart (the two hosted "Demo Manager" profiles, G1).

| Check | Result |
|---|---|
| `npm test` | 656 passed across 50 files. New `allocation-grid.test.ts` covers splitting, leftover cents at the largest amount, reading and re-saving the seeded 50/20/30 plan, previews and save problems. The target form tests now drive the grid (split and saved cells, leftover cents, save blocking, untouched round-trip, recalculation after an edit, quarter tabs, over-allocation, inactive members); the old per-row percentage tests were removed with that UI |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| Full Playwright suite with `E2E_LIVE_WRITES=1` | 26 passed in 5.0 min, including the rewritten `live/targets.spec.ts` (the save request is blocked) |
| Signed-in, read-only: the hosted 2026 demo draft opened in the grid | Q1 shows one Demo Manager at 75,000.00 split 100% DSP and Demo Member at 75,000.00 split Project 60% (45,000.00) and VBD 40% (30,000.00), with 0.00 left to allocate, matching the saved cells |
| Phone width (390 px), new and edit target forms and the plan page | No horizontal page scroll; the grid scrolls inside its own area. The first check found the form 744 px wide, because a fieldset grows to its widest content, and this was fixed |
| Hosted demo after the runs | Still 2 draft target plans and 7 contributions; no QA records |

## Contribution stage and attribution rules on 28 October 2026

Two decisions on contribution integrity, each enforced in the service and in the database:

- **Open or won deals only.** A Lost, Abandoned or Junk deal no longer accepts new contributions. The service returns 422 naming the stage, and migration 0012 adds the same check to the contribution insert trigger. The deal page hides **Record contribution**, and the contribution page explains instead of showing the form. Receipts recorded before a deal closed stay valid, and closing a deal that has receipts is not blocked.
- **Members credit themselves.** A member's contribution is credited to the member, and the form shows a fixed field. A PSE manager or admin can credit any active employee and starts from the deal's focal person. The service returns 403 otherwise, and migration 0013 replaces the `member_insert` RLS policy with the same rule, so a direct table insert is held to it too.

| Check | Result |
|---|---|
| `npm test` | 648 passed across 49 files; 11 added (5 stage outcomes through the API, member/manager attribution through the API, member and manager form views, 2 PGlite database tests, and the fresh-project demo seed test) |
| The 2 database tests with migrations 0012/0013 removed | Both failed, confirming they test the migrations |
| `npm run lint`, `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed; generated types unchanged (no column changes) |
| `live/contributions.spec.ts`, development server against the hosted demo | Passed: an open QA deal offers the form and its save is blocked in the browser; after a move to a closed, not-won stage the button is gone and the page explains why. The hosted demo still has 7 contributions and no QA records |

| Full Playwright suite with `E2E_LIVE_WRITES=1` and both accounts | 26 passed in 4.6 min |

The hosted database checks wait until 0012/0013 are applied there; until then only the application-level checks protect the hosted demo.

Demo seed adjusted for the new rule (decided 28 October 2026). `seed:finance` writes its six receipts in one statement, and one of them, 200 USD, went to "Overseas education grant", which `seed:demo` created as Lost. On a fresh project the rule would have refused that receipt and rolled back all six, leaving targets with no actuals. For fresh projects, `seed:demo` now creates that deal as **Won** (partially received) and "Community classroom sponsorship", which receives no seeded receipt, as **Lost**, so all eight stages are still shown once each. A new PGlite test seeds the real demo deals and all six receipts through the trigger; with the previous stages it fails with the rule's message. The hosted demo is unchanged: the seeders only add missing records, so its Lost USD deal keeps the receipt it already has, which the rule allows.

## Restricted account check on 28 October 2026

A non-PSE account (Auth user with a `Finance` department profile, fictional email) now exists on the hosted demo for `tests/e2e/sign-in.spec.ts`. Its first run exposed a test defect, not an app defect: the app showed "This account does not have PSE access", but the assertion matched every `role="alert"` element, including Next.js's empty route announcer. The assertion now matches the message itself.

| Check | Result |
|---|---|
| `sign-in.spec.ts`, development server and the Vercel deployment | 6 passed on each, including the restricted account being refused and sent back to sign-in |
| Default Playwright suite with both accounts in `.env.local` | 21 passed, 4 skipped (the opt-in live specs) |

## Signed-in browser specs on 28 October 2026

The signed-in acceptance checks are now opt-in Playwright specs in `tests/e2e/live`, run with `E2E_LIVE_WRITES=1` and the demo credentials. They run against the hosted demo project and use the shared `tests/e2e/helpers/live.ts`:

- Every live test blocks, in the browser, the hosted writes that cannot be undone: recording a contribution, creating, saving or approving a target plan, and adding verticals, stages or categories. The target spec checks that its save attempt was blocked.
- Records are named "QA …" and registered for cleanup. A fixture with its own time budget deletes them after the test, including after a failure or timeout. The first run showed why: the workflow timed out against a compiling dev server, and cleanup inside the same budget could not run. That run's four QA records were deleted by hand, and the fixture was checked to tear down after a timed-out test.

| Spec | Covers |
|---|---|
| `live/workflow.spec.ts` | Contact → deal → meeting (linked to the deal) → activity (linked to the meeting); edits of all four that survive a reload; a stage move shown in the deal's audit history; deletes of the contact, deal and meeting blocked while a linked record exists; deletion in reverse order, each confirmed by a 404 |
| `live/contacts.spec.ts` | Company and person linked by workplace, edit, search, duplicate warning and rejection, blocked company delete, deletion. It replaces the earlier `E2E_CONTACT_WRITES` case in `contacts.spec.ts` |
| `live/lists.spec.ts` | A page past the end on all six lists redirects to the last page with its filter kept and no error panel (read-only) |
| `live/targets.spec.ts` | On a new, unsaved draft: a member's amount split across two verticals, the split status (including over 100%), an unfinished split blocking the save with a message, calculated amounts, the quarter summary, separate quarters, and the save request blocked |

| Check | Result |
|---|---|
| Full Playwright suite with `E2E_LIVE_WRITES=1`, against the development server | 24 passed, 1 skipped (no restricted account), 3.9 min; the workflow spec alone takes about 2.2 min |
| Default suite (credentials in `.env.local`, live specs off) | 20 passed, 5 skipped |
| Hosted demo after the runs | No contact, deal, meeting or activity named "QA …" remains (read-only API search) |
| `npm run lint`, `npm run typecheck`, `npm test` (637 across 49 files), `npm run build`, `validate:seed`, `db:types:check` | Passed; no application code changed |

## Display fixes and requirement mapping on 28 October 2026

Three display fixes, plus a documentation pass that maps the assessment's open dashboard items:

- The target plan page showed "No target%" when a plan had no annual amount; the percent sign now appears only with a number. A saved plan always has a positive annual amount (database check), so this guards a state the data cannot currently reach.
- A contact's **Recent opportunities** list formatted expected values with the browser's currency style (for example "$2,500.50"), unlike every other page; it now uses the shared money format ("USD 2,500.50").
- The deal page's **Recognized contributions** section and the user guide no longer call contribution entry a later workflow, and the target percentage limitation below describes the current behavior.
- [Requirements and assumptions](01-requirements-and-assumptions.md) now records lead, meeting/event/monthly target, team-level and events-module questions against the assessment pages. [Reporting definitions](09-reporting-definitions.md) maps the original Lead, Meeting, Achievement and Events indicators to what the dashboard shows.

| Check | Result |
|---|---|
| `npm test` | 637 passed across 49 files; 1 added check (contact history money format; its USD case fails against the previous formatter) |
| `npm run lint` (includes the format check), `npm run typecheck`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| Playwright, anonymous, against the running development server | 19 passed, 3 skipped (no live credentials configured) |
| Signed-in browser check, local development server | Target plan shows "Annual attainment: 0.00%."; contact Recent opportunities show "BDT 50,000.00 expected" (the demo data has only BDT deals, so the USD case is covered by the unit test); the deal page shows the new contribution text and no "later workflow" |

## Preview deployment on 28 October 2026

`main` at `04710f8` (the end of the readability refactor, before the display fixes above) is deployed on Vercel at https://private-sector-engagement-crm.vercel.app with the two public Supabase variables and `PSE_REPORT_CACHE_ENABLED=false`; no service-role key is configured there.

| Check | Result |
|---|---|
| Playwright against the deployment, with live sign-in credentials | 20 passed, 2 skipped (contact writes not enabled; no restricted account) |
| Signed-in, read-only walk of the deployment (writes to `/api` blocked) | Dashboard, Reports, stage board, Settings, Verticals, and every list page with its first detail page (contacts, deals, meetings, activities, contributions, targets) returned 200 with no error panel or browser console error |

## Bug fixes on 28 October 2026

Three known issues were fixed after the readability refactor (details under [remaining checks and limitations](#remaining-checks-and-limitations)): target allocation percentages, list pages past the last one, and the live contact workflow test's time limit.

| Check | Result |
|---|---|
| `npm test` | 636 passed across 48 files; 18 added checks (12 pagination, 6 target percentage) |
| `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm run build`, `validate:seed`, `db:types:check` | Passed |
| New tests against the previous code | Pagination: 6 failed; target percentages: 7 failed (the original percentage test no longer clicks Apply) |
| Full Playwright suite with live credentials, default configuration | 21 passed, 1 skipped (no restricted account); the contact workflow passed in 52.7 s under its own 2-minute limit |
| Signed-in checks on a production build | All six lists redirect from a page past the end to the last page with filters kept; target rows show their saved share, flag invalid percentages and save typed percentages; regression checks passed |

The pagination tests drive each list query through the real Supabase client with a transport that answers like PostgREST (416/`PGRST103` past the end), and confirm the retry repeats the same filters on page 1 while a failure on page 1 is still reported. The target form save during signed-in checking re-entered an existing row's percentage, so no hosted amounts changed; no contribution was recorded and no plan approved.

## Phase 12 performance and caching on 27 October 2026

| Check | Result |
|---|---|
| `npm.cmd test` | 618 passed across 47 files; 46 added checks since Phase 11 |
| `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` | Passed; cache adapter, report refresh route and updated UI compile |
| Full implemented Chromium suite | Nineteen anonymous checks passed; three optional live cases skipped |
| `npm.cmd run benchmark:reports` | Passed using an isolated local PostgreSQL database and fictional data; raw evidence in [report-cache.json](benchmarks/report-cache.json) |

Cache tests cover project/user/role/session/filter separation, hard report/metadata expiry, failure without stale fallback, redacted stored names with fresh permitted profile hydration, denied access after deactivation despite a warm entry, global versus user invalidation and excluded raw credentials. Real SDK fetch contracts verify a cookie-free caller bearer, publishable key and no-store requests. Factory tests capture sessions outside cached loaders, reject mismatched/missing identities, handle provider failures safely and exercise the uncached override. Adapter tests verify Next's TTL/tag arguments and blocking `expire: 0` invalidation from each affected write path. Refresh transport/UI tests verify authorization, matching Origin, safe failure and refresh only after successful invalidation.

The local benchmark includes 10,002 selected BDT receipts and measures fresh local membership/profile access plus the shared report service read/options path. Across 25 samples, uncached median/p95 were 46.333/54.672 ms; warm cache-policy median/p95 were 5.316/7.097 ms. A cold cached request took 48.340 ms. One cold plus 25 warm requests issued one report and one vertical query while all 26 still checked authorization/profile data. Assertions verify equal report values, receipt visibility after invalidation and denied access following profile deactivation.

The benchmark's storage is the isolated `MeasurementCache` driver. It does not measure Next Data Cache persistence, Supabase JWT/network verification, HTTP/RSC/browser latency or distributed invalidation. No hosted speedup is claimed. Production code delegates to Next Data Cache; its cross-instance behavior and authenticated hosted acceptance remain manual. `PSE_REPORT_CACHE_ENABLED=false` bypasses both caches and should be used on unverified self-hosted replicas. Authorized report API responses expose total handler duration through `Server-Timing` for later real HTTP measurement.

Browser checks reused the existing port-3000 server and left it running. No live credentials, impersonation, hosted data changes or migrations were used in this checkpoint. Seed/catalog checks were already passing in Phase 11; Phase 12 changes no SQL schema or fixture definitions. Signed-in freshness, independent sessions and production cache-handler propagation remain acceptance work. The [manual guide](06-user-guide.md#try-phase-12-caching-and-freshness) covers those steps. Older sections below retain the results and limitations of their own checkpoints.

## Phase 11 reporting and Activity context on 27 October 2026

| Check | Result |
|---|---|
| `npm test` | 572 passed across 42 files; 70 added context/reporting checks |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed; real Dashboard/Reports pages and API compile |
| Full implemented Chromium suite, including `reports.spec.ts` | Eighteen anonymous checks passed; three optional live cases skipped |
| `npm run validate:seed`, `npm run db:types:check` | Passed with eleven migrations and 13-table types |
| Hosted migration | Project matched app configuration; dry run identified only 0010/0011; context constraint and read-only reporting function applied successfully |

PostgreSQL checks verify actual/target/forecast separation, fixed Q2 and Q1 attainment, missing/monthly targets, currency isolation, employee/vertical attribution, unassigned receipts, configurable stages/current outcomes, undated data, owner scopes, Dhaka inclusive/exclusive boundaries and zero-filled monthly buckets. Aggregation includes 1,101 receipts without REST truncation. Repeated reads see a new receipt immediately and reporting changes no audit rows or baselines. Restricted/inactive/anonymous callers and invalid parameters are denied.

The Activity gap has shared-schema and SQL tests for non-whitespace independent context, all three valid link alternatives, clearing the last context, and historical NOT VALID behavior. A legacy row remains readable and is counted for correction; its update fails until accurate context is supplied. Existing Activity tests/helpers now include explicit fictional context where appropriate, and future activity seed examples do too. No hosted names/context were silently backfilled.

API/service tests verify fresh PSE identity/profile matching, strict periods/UUIDs/currency, authorization before queries, safe errors, no-store responses and fresh queries on every read. SDK contracts inspect one parameterized aggregate RPC, explicit quarter/month/unassigned values and bounded metadata. DOM checks cover separate financial/workload sections, draft/missing/monthly targets, filter preservation, full tables, relative bars with accessible exact values, correction notices and Refresh. The initial build found an overly broad test-mock type; the mock was typed and the subsequent type check/build passed.

Anonymous browser checks reused the running port-3000 server and left it running. No live credentials, impersonation or hosted record mutations were used. Real signed-in hosted RPC/RLS, visual layout on user devices and independent concurrent sessions remain manual acceptance work. Database coverage uses the local PostgreSQL/Auth adapter; it does not independently prove hosted JWT behavior. No shared cache or benchmark improvement is claimed. Target plans/receipts/stages/activities were not approved, changed or deleted by migration/report testing.

[Reporting definitions](09-reporting-definitions.md) record date/filter/count rules. Monthly quotas, historical pipeline reconstruction and unique contacts/lead/follow-up-rate KPIs are not invented. Pipeline stage charts cap at 12 while full tables/totals remain complete. Metadata lookups cap at 1,000; money/count aggregates use all eligible rows. Older checkpoint sections below retain their historical results/limitations.

## Phase 10 contributions, target allocation and performance on 27 October 2026

| Check | Result |
|---|---|
| `npm test` | 489 passed across 36 files; 71 new Phase 10 checks |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed; new Contributions/Targets pages and financial API routes compile |
| Full implemented Playwright suite | Sixteen anonymous Chromium checks passed; three optional live cases skipped |
| `npm run validate:seed`, `npm run db:types:check` | Passed against eight migrations and 13 tables |
| Hosted migration | Project matched private app configuration; dry run identified only 0008; workflow functions/revision triggers applied successfully |

PostgreSQL tests exercise atomic draft snapshots, complete rollback on invalid replacement, removal of old draft cells, stale-version saves/approval including direct child changes, denied member/non-PSE/inactive/anonymous mutations, reconciliation and permanent approval locking. Receipt tests verify fixed recorder identity, identity/precision rejection, identical retry deduplication, changed-payload conflicts, manual in-kind evidence and append-only storage. Actual aggregation covers Dhaka quarter boundaries, explicit/unassigned attribution, separate currencies and over 1,000 eligible receipts while preserving Q2's target. Existing approval-audit tests now select the approval transition explicitly because child-revision tracking adds draft header audit entries.

API/service checks cover fresh identity/profile guards, team reads, manager-only target writes/configuration, exact reviewed versions, strict inputs, matching Origin, JSON limits, missing references, preserved attribution, safe provider failures and reconciliation errors. SDK contracts verify atomic RPC payloads, decimal strings, Dhaka day filters, bounded lookups/history and complete pagination of a 1,001-cell allocation grid. Target details reject data assembled across different plan revisions. DOM tests exercise contribution review/confirmation, manual UTC conversion, frozen ambiguous submissions and identical retries, incomplete draft saving, percentage rounding/remainder, preserved drafts after conflicts and explicit lock acknowledgement.

All anonymous browser checks reused the existing port-3000 development server, which was left running. Live sign-in/write cases remained disabled at the developer's request. No hosted receipts, target plans or profiles were inserted/changed by Phase 10 testing. Migration 0008 adds functions/triggers but does not recognize funding or lock any existing plan. Authenticated hosted JWT/RLS, actual financial RPC acceptance and interactive signed-in persistence remain manual checks. PostgreSQL tests use a single-connection local adapter: lock design and stale-version behavior are tested, but independent concurrent hosted sessions are not proven by this harness.

The initial type check reused stale incremental diagnostics from the earlier ES2017 target. A clean TypeScript check and production build pass with ES2020, which supports the integer-cent BigInt arithmetic used here. Vitest's existing forward-looking configuration-loader warning remains non-failing. The assessment mapping is in [requirements](01-requirements-and-assumptions.md#phase-10-assessment-check); the [manual guide](06-user-guide.md#try-phase-10-contributions-and-targets) covers setup and acceptance. Earlier checkpoint sections below retain their historical results/limitations.

## Activities, deletion, hosted seed and assessment review on 27 October 2026

| Check | Result |
|---|---|
| `npm test` | 418 passed across 32 files; 74 new Activities checks |
| `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts activities.spec.ts` | Twelve anonymous Chromium checks passed; three optional live cases skipped |
| `npm run lint`, `npm run typecheck`, `npm run build` | Passed; list/new/detail/edit and Activities API routes compile |
| `npm run validate:seed`, `npm run db:types:check` | Passed; seven migrations and unchanged 13-table types |
| Linked Supabase migration | Dry run identified only 0007; activity deletion grant/RLS applied successfully |
| `npm.cmd run seed:activities -- --apply` | Inserted/verified 11 hosted activities, all 11 required types, including four independent entries |

Local SQL tests verify owner/creator/manager deletion, denied unrelated/inactive/non-PSE/anonymous mutations, retained audit snapshots and parents, compatible direct and meeting-derived links, immutable identity, and deletion that can unblock parent meeting deletion. Creation, completion, deletion and demo insertion/reruns leave recognized contributions, opportunity values and target allocations unchanged. Legacy non-monetary estimates remain untouched by status/detail writes.

API tests exercise the real shared service through mocked repositories: all 11 independent types, optional links/free context, partial-update preservation, verified creator, manager-only owner assignment, inactive historical ownership, unavailable references, same-origin/content/size/strict-field validation, safe failures and zero-row writes. SDK contracts inspect real Supabase-generated filters/joins, literal search, direct-context filters, Dhaka date boundaries, deterministic pagination, audit/owner bounds and scoped deletes. DOM tests cover independent creation, UTC conversion, lookup-in-progress submission protection, preserved drafts, status changes and confirmation/cancel/error/duplicate-delete/Escape behavior. Native dialog focus and keyboard interaction still need manual browser testing; jsdom substitutes dialog methods.

The configured hosted project matched the app before migration. The administrative seed inserted only missing stable activity IDs for the existing Demo Manager and verified real PostgREST relationships. It did not provision users or alter parents, forecasts, targets or actual contributions. A subsequent read-only preview found all 11 entries and zero missing inserts. No hosted record was deleted as a test. End-user JWT/RLS, authenticated browser persistence and interactive mutation acceptance remain manual, as requested; anonymous tests reused the existing port-3000 server and left it running.

The assessment mapping is in [requirements](01-requirements-and-assumptions.md#activities-assessment-check). Work-category/status keys, required descriptive notes, optional time, ownership permissions and user-requested deletion are documented project choices. All CRM links can be absent; unlinked text is not automatically a contact identity. Events and Meeting-type work logs do not create separate calendar/financial records. No Gmail sync, direct uploads, external autofill, automatic valuations, financial recognition or unapproved KPI was added. Relevant-time filters exclude undated entries; lists show 20 rows and audit history 20 entries. Full reporting, target/contribution-entry UI and deployment remain pending. Earlier sections below record historical checkpoint results and limitations at the time.

## Meeting deletion, hosted examples and assessment review on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 344 passed across 28 files; 33 additional meeting deletion/seed checks |
| Combined sign-in/Contacts/Opportunities/Meetings E2E | Ten anonymous Chromium checks passed, including blocked anonymous meeting DELETE; three live cases skipped |
| Lint / TypeScript / production build | Passed |
| `validate:seed` / `db:types:check` | Passed with all six migrations; types still match all 13 tables |
| Linked Supabase migration dry run, then push | Confirmed only 0006 pending and applied it; no records deleted by migration |
| `npm.cmd run seed:meetings -- --apply`, then preview | Inserted/verified six meetings for Demo Manager (Scheduled 3, Done 2, Cancelled 1); repeat preview found zero missing inserts |

SQL tests verify deletion by owner/creator/manager, denial for unrelated/non-PSE/inactive/anonymous callers, revoked access on own records, retained contacts/opportunities/audit snapshots, blocked activity/follow-up references with no cascades or failed-delete audit, and Done/Cancelled deletion without financial mutation. API/service/SDK tests cover authorization, requested-ID/affected-row handling, matching Origin, no-body DELETE and safe 409 mapping for both reference-conflict codes. DOM tests cover named confirmation, cancellation, successful navigation, conflicts and pending duplicate/cancel/Escape prevention.

The meeting-seed tests validate six deterministic fictional records, status/link/timezone variation, use of current parent contact points, no automatic recreation of deleted parents, PSE visibility, repeat-run preservation of edits, and unchanged financial/activity records. Hosted application used the private administrative connection and preserved existing meetings/parents/financial data. Real PostgREST meeting/contact/opportunity joins were verified. Normal application clients remain caller-scoped under RLS; live login and authenticated browser deletion remain manual. Anonymous browser tests reused and left the existing port-3000 server running. No live end-user opportunity/contact/meeting was deleted as a test.

The Word assessment's original Meetings fields and later relationship/follow-up/visibility/internal-search clarifications were reread and compared with the code. Confirmed behaviors are mapped in [requirements and assumptions](01-requirements-and-assumptions.md#meetings-assessment-check). Title/owner requiredness, optional description, Cancelled, live-linked contact details and detailed edit/delete rules remain project choices; deletion is explicitly user-requested. Named-individual requiredness for company-only meetings remains a PSE clarification. Full Activities editing/reporting and the broader assessment remain pending; this checkpoint is not a claim that the whole CRM assessment is complete.

## Meetings verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 311 passed across 25 files, including 74 additional meeting SQL/service/API/SDK/form/date checks |
| `npm.cmd run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts meetings.spec.ts` | Ten anonymous Chromium checks passed; three optional live cases skipped |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed; Meetings list/new/detail/edit and options/follow-up API routes compile |

SQL/RLS tests verify contact-only and opportunity-only persistence, company party/primary/secondary compatibility, mandatory linkage, designation/communication joins, UTC status auditing, team reads, owner/creator/manager edits, manager-only assignment/reassignment, restricted actors, unchanged inactive historical owners and reverse relationship guards when linked follow-ups exist. Follow-up tasks persist as open activities linked to the meeting without changing forecast, target or actual contribution values. Shared-service tests additionally cover identity mismatch, partial-update preservation/clearing, stale selections and nullable inherited context.

API and real-SDK/mock-HTTP tests verify strict payloads, verified creator binding, same-origin/JSON limits, safe errors, filter bounds, stable 20-row pagination, full Dhaka-day ranges and bounded 20-row activity/audit history. Upcoming means scheduled from now; completed means done. Period/status filters intersect and direct-contact filtering does not include opportunity-derived contacts. Form/date tests cover Dhaka-to-UTC round trips across dates, invalid calendar input, derived contact information, preserved drafts/errors, internal opportunity selection, waiting for deal details before submission, status-only completion and follow-up retry after failure.

The combined browser run reused the existing localhost:3000 server and left it running. It verifies anonymous APIs/redirects, including Meetings options/new/detail/edit/follow-ups. Live credentials/writes were disabled, honoring the developer's manual-testing preference. No schema migration, hosted login, hosted meeting/follow-up seed or hosted mutation was performed for this checkpoint. Existing tables/types/RLS already support the workflow. Authenticated hosted PostgREST joins, browser persistence, native keyboard/focus and current-user permissions still require manual acceptance.

At the initial Meetings checkpoint, deletion had not yet been added; the subsequent deletion/seed checkpoint is recorded above. The full Activities workspace, follow-up status editing and standalone work logging remain pending. Required title/owner and optional Cancelled status are existing project choices; organization/designation/communication are internal linked data rather than external autofill or snapshots. Follow-up relevant date/time uses the existing activity timestamp and is not a separate due-date/reminder feature. No Gmail sync, uploads, calendar integration, valuation engine or follow-up KPI was introduced.

## Opportunity deletion verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 237 passed across 19 files, including 31 additional deletion checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts` | Eight anonymous Chromium checks passed, including rejected anonymous opportunity DELETE; three live cases skipped |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed |
| `npm run validate:seed` / `npm run db:types:check` | Passed with all five migrations; generated types still match all 13 tables |
| `npx.cmd supabase db push --dry-run` then `npx.cmd supabase db push --linked --yes` | Confirmed only migration 0005 was pending, then applied it to the same project configured for the app |

Local SQL tests independently verify focal-person, creator and manager deletion; unrelated/non-PSE/inactive/anonymous denial; inactive/non-PSE owners losing access; FK restrictions for meetings, activities and recognized contributions; retained contacts; retained actor/before audit snapshots; no delete audit on a rolled-back FK failure; and deletion of an unlinked Won deal without altering actual achievement. Service tests exercise the same permissions under SQL/RLS. API/SDK tests cover strict requested-ID deletion, affected-row checks, same-origin requests, missing IDs, no-store responses and safe 409 mapping for both `23503` and `23001`.

DOM tests cover named confirmation, cancellation without a request, successful navigation, visible conflicts, disabled duplicate submission/cancellation and blocked Escape dismissal while pending, plus retry after network failure. Native dialog focus behavior remains a manual browser check. Anonymous checks reused the existing port-3000 server and left it running.

The hosted migration adds a DELETE grant/policy only; it deleted no existing opportunities or other records. No hosted opportunity deletion or live login was executed; the developer's preference for manual authenticated browser testing remains in effect. End-user hosted permission/persistence checks remain manual. Deletion is an explicit user-requested addition, with ownership matching the existing edit policy; recognized-contribution correction/deletion remains excluded.

## Hosted demo seeding on 26 October 2026

The separate `scripts/seed-demo.ts` command previews or explicitly inserts 3 fictional companies, 8 individuals and 8 opportunities into the configured project. It requires an existing active PSE owner and a private server-side key, preserves existing rows on repeat runs, checks communication-identifier collisions before writes, and initializes provisional lookups only when their tables are empty. It does not provision users or create received contributions/targets. The administrative transport is separate from the normal caller-scoped application path.

All 206 tests across 17 files passed, including six additional checks for the generated dataset, active configuration/owner selection, collision checks, actual SQL/RLS relationships and rerun preservation of user edits. Typecheck, lint and production build passed. Local tests also verify that this dataset leaves existing profiles, targets and recognized contributions unchanged. The runner rejects placeholder/non-administrative keys before making requests.

After the developer privately configured the key, the hosted preview confirmed 3 companies, 8 individuals and 8 opportunities were missing, with no stage/category setup needed. `npm.cmd run seed:demo -- --apply` inserted them and verified the stored records plus contact/stage/category joins through real PostgREST. They are assigned to the existing Demo Manager. A subsequent read-only preview reported 11 contacts and 8 opportunities already present, with zero inserts needed. No received contributions, target values, Auth accounts or profiles were inserted/changed.

The ordinary `npm` PowerShell invocation consumed the `--apply` flag and only previewed; using `npm.cmd` forwarded it correctly. This verification used administrative access, not an end-user session. Hosted sign-in, interactive browser persistence and end-user RLS/filter acceptance remain manual checks. Earlier checkpoint notes below describe their historical runs before this hosted demo insert.

## Opportunities verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 200 passed across 16 files, including 49 additional opportunity service/SQL, SDK, API and form checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts opportunities.spec.ts` | Eight anonymous Chromium checks passed; three live cases skipped |
| `npm run typecheck` / `npm run build` | Passed; list/new/detail/edit, Settings and new API routes compile |
| `npm run lint` / `npm run validate:seed` / `npm run db:types:check` | Passed; seed integrity retained and generated types match all 13 tables |

Shared-service tests use disposable PostgreSQL/RLS to verify individual/company deals, both contact people, optional fields/budgets, partial-update preservation, positive finite decimal values, manual in-kind valuation, owner/creator/manager editing and reassignment, inactive historical selections and empty-project provisional configuration. Stage moves retain before/after audit snapshots and create no recognized contributions. Database tests independently reject unrelated edits, non-manager configuration, incompatible meeting/activity links and changes to recognized-contribution currency/type. The seed/type scripts initially hit the known Windows user-info sandbox error and passed when rerun outside the sandbox.

SDK tests use the real Supabase client with mocked HTTP to check literal search, combined filters, deterministic pagination, FK selections, bounded history, configuration writes and safe error mapping. API tests cover verified creators, no-store responses, same-origin writes, JSON/size checks, strict fields, role denial and safe exceptions. DOM tests check required financial value/valuation, inline contact creation preserving the deal draft and selecting the new contact without navigation or nested forms, error preservation, reference URLs and rejected stage moves. Contact form regression tests still pass after adding callback support.

Anonymous browser checks cover opportunity APIs/configuration and redirects for board/new/detail/edit/Settings. They reused the developer's running port-3000 server, which was left running. Live login and contact-write cases were explicitly disabled in keeping with the developer's manual-testing preference. No hosted login, deal/contact/configuration writes, schema changes or new migrations were performed. Full authenticated hosted persistence, actual PostgREST join/filter behavior and native dialog focus/keyboard behavior remain manual checks; jsdom uses dialog method substitutes.

The original assessment fields are represented, with primary company contact required and secondary optional pending confirmation. Final stages are not hardcoded: manager configuration uses stored IDs/outcomes; optional assessment examples are explicitly provisional. The board and expected-value subtotals cover only the current 20-deal page. Details show recent actuals/audits rather than full totals. Lookups cap at 1,000 entries each. Configuration example setup uses sequential, retryable writes and is not atomic. No uploads, external autofill, Gmail sync, automatic valuations or unapproved lead/follow-up KPI are introduced.

## Contact deletion verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 151 passed across 12 files, including 27 additional deletion checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts` | Six anonymous browser checks passed, including blocked anonymous DELETE; three live cases skipped |
| `npm run validate:seed` | Passed with all four migrations |
| `npm run db:types:check` | Types still match all 13 tables |
| `npm run lint` / `npm run typecheck` / `npm run build` | Passed |

Real local SQL tests verify creator/manager deletion, rejection of colleagues/non-PSE/inactive/anonymous actors, retained actor/before audit data, and protection of company associations, opportunity parties/primary/secondary contacts, meetings and activities. Service/API/SDK tests verify permissions, affected-row checks, same-origin requests and safe HTTP 409 mapping for both PostgreSQL RESTRICT/reference conflict codes. DOM tests verify confirmation, cancellation without a request, pending-state duplicate-submission protection and visible conflict errors.

No hosted migration or contact deletion was executed. The optional live Contacts workflow now exercises linked-company rejection and removes its own fictional records on success; it was skipped. The new migration must be applied by the developer before manually testing hosted deletion. Database types did not change because migration 0004 only adds a grant/policy. Local migration loading now discovers sorted migration files rather than hardcoding the first three.

## Contacts verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 124 passed across 10 files, including 36 new Contacts workflow/query/API/form checks |
| `npm run test:e2e -- sign-in.spec.ts contacts.spec.ts` | Six anonymous Chromium browser checks passed; three optional live cases skipped |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; contact list/new/detail/edit and API routes compile |

Shared service tests execute against disposable PostgreSQL with RLS to verify persistence/reload, phone-only individuals, optional company links, normalized duplicates, self-exclusion on edit, partial-update preservation, restricted editing and identity/creator mass-assignment rejection. Query-contract tests use the real Supabase SDK with a mocked HTTP transport to inspect pagination, FK selections, quoted filters and safe database-error mapping. API tests exercise authorization, same-origin checks, JSON limits, response statuses and shared-service delegation. DOM tests cover validation, company/individual modes, duplicate warnings, preserved values after conflicts, saving and keyboard selection of internal companies.

Anonymous browser checks additionally verify contact POST/PATCH/duplicate access and detail/edit redirects. The runner initially tried to start a second Next.js dev server; it then successfully reused the developer's existing port-3000 server through `E2E_BASE_URL`. That server was left running. Live login and contact-write tests were explicitly disabled for the run, honoring the developer's manual-testing preference. No hosted contacts, users or profiles were created or changed by these checks.

The optional live contact test requires private demo credentials and `E2E_CONTACT_WRITES=1`; its newer deletion behavior is described in the checkpoint above. It was not run. Production PostgREST joins/filter semantics and full authenticated browser persistence remain part of manual hosted verification; local SQL/service tests and SDK-contract tests do not establish that verification.

## Authentication verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 88 passed: 43 database checks and 45 authentication/action/proxy checks |
| `npm run test:e2e -- sign-in.spec.ts` | Four anonymous Chromium browser tests passed; two optional live-account cases skipped |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; authenticated pages are request-rendered |

Mocked Auth checks cover active member/manager/admin access, missing/inactive/non-PSE/invalid profiles, identity/profile mismatch, rejected sessions, provider failures, caller-scoped profile lookup, manager guards, login field validation, password preservation, safe return paths, logout error handling and cookie forwarding on refresh/redirects. They use no live credentials. Public configuration rejects privileged keys without disclosing their values.

Browser checks cover root-to-login navigation, anonymous dashboard/nested-route redirects, JSON 401 on all seven CRM API stubs, and refusal of external return URLs. The browser suite completed successfully after running outside the restricted sandbox to allow development-server shutdown. The initial sandbox run completed its checks but hung on teardown and was interrupted; it is not counted as a separate pass.

The developer chose to test live sign-in manually. Real demo-account login/logout, cookie expiry/refresh and hosted profile deactivation were not tested by the agent. The developer reports configuring Supabase and applying migrations/RLS; that report is distinct from the automated evidence above. No remote users/profiles were created or changed during this checkpoint.

## Database foundation verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 43 tests passed across contacts/access, financial integrity and target approval |
| `npm run validate:seed` | Migrations and fictional seed applied successfully; reconciliation, financial totals and basic role checks passed |
| `npm run db:types:check` | Generated types matched all 13 migrated tables |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.4.3 |

These database tests execute actual SQL using PostgreSQL 18.6 through PGlite 0.5.11. Each database suite gets a fresh database, with a local-only Auth identity adapter supplying `auth.users`, `auth.uid()` and database roles. These checks do not test hosted Supabase JWTs or real accounts. Do not deploy the adapter as application authentication.

The TypeScript runner initially could not read Windows user information inside the restricted execution sandbox. Seed validation and type generation/checking passed outside that sandbox. Tests, lint, typecheck and build passed. Vitest emits a forward-looking Vite configuration-loader warning; it does not fail the checks.

## Verified database behavior

- Every CRM table enables RLS. Non-PSE and inactive profiles cannot read CRM rows; anonymous access is denied. Active PSE members can read colleagues' permitted records.
- Client profile escalation, forged creator/recorder identities and direct audit writes are denied. Internal privileged functions use fixed search paths and restricted execution grants.
- Contacts require email or phone; normalized duplicates fail. Individuals may exist without a company. Company associations, URLs and contact-kind integrity are checked.
- Company opportunity primary/secondary contacts and optional budgets persist in the fictional seed. Meetings may use the company party or designated individual contact; contradictory links and parent edits that break existing links are rejected.
- Independent activities retain person/organization context and remaining work without CRM links.
- Forecasts, operational budgets, unvalued activity estimates and recognized contributions stay separate. Invalid/non-finite financial amounts and currency/type mismatches are rejected. Mixed-currency totals are checked separately.
- Agreed in-kind notes and estimate references persist. Contribution rows retain explicit employee/vertical attribution when opportunity ownership changes. Contributions are append-only; automatic valuation is absent.
- Manager approval requires four quarters summing to the annual amount and a reconciled employee/vertical grid for every quarter. Members cannot approve or edit targets. Direct status updates cannot bypass reconciliation.
- Approved headers, quarterly baselines and allocation cells are immutable. Q1 achievement remains 110% and Q2's 250,000 BDT target stays unchanged in the seed.
- Audit snapshots retain the actor and before/after values. Audit history is immutable and hides unrelated non-PSE profile history. Historical notes can still be edited by an authorized manager after an owner is deactivated.

## Remaining checks and limitations

- Independent hosted Supabase role/security verification and live Auth sessions remain pending manual checks. The local engine uses PostgreSQL 18; verify compatibility against the selected hosted PostgreSQL version when integrating.
- Parent-row locks serialize target edits and approval in the SQL design. The single-connection local harness does not prove multi-session race behavior; add a two-session hosted/local-server test during integration.
- Contacts, Opportunities, Meetings and Activities forms/services, including inline New Deal contact creation, stage configuration and meeting follow-up task creation, are implemented. Dashboard/Reports and scoped caching are implemented; unapproved contacts-engaged/lead/follow-up KPIs, signed-in/multi-instance acceptance and production deployment remain pending. Reports/Targets/Contributions/Meetings/Opportunities/Activities E2E cover anonymous boundaries only.
- Contact history is a recent-record view: up to 10 opportunities, 10 meetings and 20 activities, including indirect links only through the recent parents shown. It is not an exhaustive report. Unlinked contact/opportunity deletion is implemented as a user-requested addition with FK protection and retained audit history; active/inactive contact lifecycle remains unresolved.
- Phone normalization strips formatting only; it does not infer country codes, leading-zero rules or extensions. Imports/entry must use consistent international numbers and review ambiguous matches.
- Currency codes are syntactically uppercase three-letter identifiers; no exchange rates, currency conversion or full currency registry is implemented.
- Allocation percentages split each member's quarter amount; parts round down to the cent, the member's last vertical takes the leftover cents, and only the resulting amounts are stored. Members must still add up to each quarter before approval. Final pipeline stages, vertical mappings and reporting formulas remain provisional.
- Refund/contribution correction and deletion workflows are not implemented. Application clients cannot edit/delete realized contributions or approved targets.
- Fixed 28 October 2026 (found in manual testing, 27 October): the target form's "% of quarter" box was a one-shot calculator that dropped a typed but unapplied percentage on save. Each box now shows the share its saved amount represents, typing a percentage updates the amount immediately (the Apply button is gone), invalid percentages are flagged under the box without changing the amount, and removing rows or changing quarter totals keeps every row's percentage correct.
- Fixed 28 October 2026 (found in signed-in acceptance testing): a list page beyond the last one (for example `/activities?page=5` when one page exists) showed "temporarily unavailable". PostgREST answers such a request with HTTP 416 (`PGRST103`) and no row count; all six list queries now re-read page 1 for the total, so the page redirects to the real last page with its filters kept.
- Fixed 28 October 2026: the opt-in live contact workflow browser test, which takes about a minute against a compiling development server, now sets its own 2-minute limit instead of Playwright's 30-second default.
- The seed contains fixed fictional Auth/profile identifiers, not login credentials. Hosted import requires trusted identity provisioning and reviewed mappings. No real JAAGO/Odoo data was migrated.

## Earlier scaffold verification

On 26 October 2026, local production-server HTTP smoke checks confirmed root/sign-in, dashboard, contact list/new/detail placeholders returned HTTP 200 and the contacts API returned HTTP 501. These were scaffold checks; they did not verify contact forms, login or private data access.

See [the local test guide](06-user-guide.md) for reproducible commands.


## Requested finance demo seed on 27 October 2026

The separate `seed:finance` runner previews before applying. It inserts only missing stable IDs, preserves existing receipts and edited target snapshots, checks vertical-code collisions and current parent types, and selects free year/currency slots. Migration 0009 provides a service-role-only, fixed-search-path atomic insert for two reserved demo target IDs; authenticated users (including target managers) and anonymous actors cannot execute it. Targets remain drafts and no session/claim impersonation is used. The original Phase 10 statements above describe the earlier checkpoint before this explicitly requested finance seed.

All **502 tests across 37 files**, lint, typecheck, production build and local seed/type checks passed, including 13 added builder/SQL checks covering dataset totals, manual in-kind evidence, independent USD/unassigned receipts, uneven reconciled allocations, free-year selection, role denial, atomic rollback, existing-plan preservation and deduplicated receipts. The previously completed sixteen anonymous browser checks remain the latest browser run; UI/auth code did not change in this seed checkpoint.

Hosted preflight found zero receipts/plans and current demo opportunities of all required types. A dry run identified only 0009, which was applied before seeding. The seed inserted three provisional verticals, two draft plans (2026/2027 BDT), 12 allocation cells for 2026 and six receipts, totaling 280,000 BDT and 200 USD separately. Stored relationships and reconciliation were verified administratively. Q1 is 165,000 / 150,000 = 110%; Q2's target remains 250,000. The 2027 draft intentionally has no cells. A subsequent preview found zero missing inserts. No opportunity values/stages, contacts, meetings, activities, profiles or roles were changed. Existing user data is not overwritten; an edited existing plan is skipped completely. Per-plan atomicity is tested; the complete multi-batch seed is retryable rather than one global transaction. Live end-user acceptance remains manual.
