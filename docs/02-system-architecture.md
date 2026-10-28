# System architecture

The database foundation separates relationship management, expected fundraising, realized contributions and fixed targets. PostgreSQL constraints, row-level security (RLS) and triggers enforce data integrity at the storage boundary. The application implements authentication, Contacts CRUD/deletion, financial Opportunities create/read/edit/delete/stage workflows, Meetings create/read/edit/delete/status with linked follow-up task creation, and Activities create/read/edit/delete/status. Phase 10 implements contribution entry, target allocation and target performance; the Phase 11 dashboard and reports now use the same authenticated data boundaries.

Contacts pages and API handlers call shared feature services. Client/server Zod schemas validate allowed input fields, business services enforce ownership and company/duplicate rules, and a caller-scoped PostgREST repository performs queries under RLS. Database uniqueness remains authoritative when concurrent submissions pass the initial duplicate check. Client duplicate checks are advisory and company suggestions query internal contacts only. Cookie-authenticated contact POST/PATCH requests require a matching Origin and JSON body. Lists use deterministic 20-row pagination; contact data uses no-store access and mutations invalidate affected page paths.

The user-requested DELETE action requires same-origin access and explicit UI confirmation. Creator/manager permissions are enforced in services and migration 0004 RLS. Existing restrictive foreign keys prevent deletion of referenced contacts without cascading work records, and the audit trigger retains the deleted contact's before snapshot and actor. This adds no table columns or administrative-client bypass.

Opportunity deletion uses the same confirmation/API/service/repository layers, with focal-person/creator/manager permission matching the existing opportunity edit policy. Migration 0005 adds the authenticated DELETE grant and matching RLS; the ordinary caller-scoped client remains in use. An atomic FK restriction blocks deletion when meetings, activities or recognized contributions depend on the deal, including relationships added after the initial service read. Reference conflicts become HTTP 409. Contacts remain intact, the database retains the delete snapshot/actor, and successful deletion invalidates the list/board/detail/edit and related Contact route paths.

Opportunities use the same page → feature service → caller-scoped repository boundaries. Services validate positive expected value, company contact people, active selections, owner permissions and manually agreed in-kind valuation. Partial updates merge stored fields before full validation. Existing database guards protect linked meetings/activities and recognized-contribution currency/type. Stage changes use ordinary authorized PATCH requests and existing audit triggers; they never insert received contributions.

The New Deal contact dialog reuses ContactForm and the Contacts API; it is a sibling of the deal form to avoid nested forms. A saved contact is committed independently and selected in the still-open deal draft, without navigation. Settings allows manager-only stage/category configuration under the existing RLS. Loading provisional examples is explicit, adds missing entries and does not overwrite team configuration. Setup uses successive writes, so an interrupted or conflicting setup may be partial and can be retried after refreshing.

The list and the stage board share one filter helper in `features/opportunities/queries.ts`. The list pages 20 rows at a time. The board has no pages (C1, 28 October 2026): `service.board()` reads three columns (`stage_id`, `currency`, `expected_amount`) of every matching deal in 1,000-row chunks and sums them in integer cents per stage and currency (`features/opportunities/board.ts`). It then reads each non-empty stage's latest cards in parallel, 10 by default, raised in steps of 20 up to 500 by the page's `cards` parameter. The same summary gives the count and expected-value line above both views, so neither is limited to one page. Details read the latest 10 recognized contributions and 20 audit entries; these are recent-record views rather than aggregate reports. Lookup lists are capped at 1,000 entries each. Reads are uncached; mutations invalidate deal/contact paths, and configuration changes invalidate Settings and the Opportunities route tree.

## Meetings and linked follow-ups

Meetings pages/API routes call shared Zod validation, an authorization-aware service and a caller-scoped repository. The existing schema requires a title, owner, absolute event time and at least one contact/opportunity link. Title/owner entry and the additional Cancelled status are project choices; Scheduled/Done, contact information, date/time and description are assessment fields. Partial updates merge stored values before full validation so changing status does not clear links, time or description. Only the owner, creator or active PSE manager/admin may edit, and only a manager assigns another owner. An unchanged historical owner remains valid for authorized edits.

A meeting may link directly to an individual or company without a financial opportunity. When an opportunity is selected, an explicit contact must be its party or designated primary/secondary contact. An opportunity-only meeting keeps `contact_id` null; the UI derives current contact information from its primary contact or party, including available designation, email/phone and workplace. Internal contact/opportunity search and controlled selection are used; no external autofill or duplicate contact snapshots are created. Contact and Opportunity detail pages provide Schedule meeting links; an opportunity also links to its filtered meeting list.

Meeting inputs/display use Asia/Dhaka and writes store UTC instants. Lists contain 20 rows per page in scheduled-time/ID order. Upcoming means Scheduled with event time at or after the request clock; Completed means Done. View, status and other filters apply together. Calendar date bounds cover whole Dhaka days, and contact filtering matches the explicit meeting contact link. Details show the latest 20 directly linked activities and 20 audit entries. Owner lookup is bounded to 1,000 permitted PSE profiles, including inactive historical choices.

The narrow follow-up form creates an `activities` row with type Task, status Open and the existing `independent_general` work category. It inherits the saved meeting/contact/opportunity links, defaults ownership to the caller, and permits manager assignment to another active PSE employee. Active PSE members may create their own follow-up on a colleague's visible meeting. Notes describe the task, and the optional timestamp is a relevant work date rather than a separate deadline field. Database guards reject parent/child relationship conflicts, including concurrent link changes. The resulting tasks open in the general Activities workspace for editing, completion and deletion.

Meeting completion and follow-up creation write no expected values, recognized contributions or targets. Existing triggers record status/detail changes; there is no separate completion-time column or automatic financial recognition. Meeting deletion uses a named confirmation, matching owner/creator/manager service and migration 0006 RLS checks, a scoped requested-ID delete and FK protection for linked activities/follow-ups. PostgreSQL reference failures map to HTTP 409; contacts, opportunities and audit snapshots remain. The migration is applied to the hosted project and creates no deletions by itself. Authenticated browser verification remains manual.

The separate administrative `seed:meetings` runner inserts only missing stable meeting IDs, using current existing demo contact/deal links and an active PSE owner. It never recreates parent records or overwrites edits. A read-only preview precedes explicit application; six hosted rows and their relationship joins were verified, followed by a zero-insert preview. Shared CLI connection helpers keep the private key outside application/browser code. This administrative verification does not establish end-user JWT/RLS/browser behavior.

## Application and deployment

The selected deployment design is browser → Next.js on Vercel → Supabase Auth and PostgreSQL. This stack and deployment platform are implementation choices, not mandates established by the supplied Word assessment. Any separate platform requirement needs verification against the recruitment email.

Pages display UI, components provide reusable elements, `features/*` owns validation and business services, and `lib/supabase/*` owns database connections. Auth server actions call shared validation/services. API guards and protected layout verify identity and database membership using a caller-scoped Supabase client. Future data services must keep those checks close to every read/mutation; RLS remains the database boundary.

`src/proxy.ts` refreshes/verifies sessions with `getClaims()` and forwards updated cookies on both request and response, including redirects. Server access checks use `getUser()` and read the caller's current profile. Active department `PSE` membership and a recognized role are required. Profiles come from trusted provisioning, not signup metadata. React cache deduplicates access checks within a server render only; Supabase fetches and auth HTTP responses use no-store behavior. Protected pages render per request.

The server-only administrative client must never enter a browser bundle. Trusted profile provisioning and role assignment are separate administrative operations, not permissions available to ordinary CRM clients.

## Code organization

Each CRM area in `src/features/<module>/` follows the same layout, so a page or route never talks to Supabase directly:

| File | Responsibility |
|---|---|
| `schemas.ts` | Zod schemas shared by browser forms and the server. Create schemas apply defaults; PATCH schemas are partial with no defaults, so omitted fields keep their stored values. |
| `types.ts` | Record types and the module's error class, a subclass of `AppError` carrying an HTTP status and per-field messages. |
| `queries.ts` | The caller-scoped repository. It maps PostgreSQL error codes to module errors; list queries recover from a page past the last one by re-reading page 1 for the total. |
| `service.ts` | Access checks (`assertVerifiedPse`), input parsing (`parseOrThrow`, `requireUuid`) and business rules such as ownership and compatible links. |
| `context.ts` / `api.ts` | Page wiring (redirects non-PSE visitors, turns module errors into a renderable result) and route wiring (authorization, same-origin writes, JSON error mapping, `private, no-store`, and cache/page invalidation after writes). |

Contributions and targets share `features/finance` (error type, database-error mapping, employee/vertical lookup, guards and API wiring). Reports add a request service that wraps the SQL aggregate in the permission-scoped cache.

Shared server and browser helpers live in `src/lib`: `api/handler.ts` and `page-data.ts` (the wiring above), `errors.ts`, `validation.ts`, `auth/guards.ts`, `cache/` (report-tag expiry in `invalidation.ts`, page revalidation in `paths.ts`, cache policy and adapter), `money.ts` (integer-cent arithmetic and formatting), `dates.ts` (Asia/Dhaka conversion), `list-href.ts`, `send-json.ts` and `supabase/` (clients and pagination recovery).

Interface code is split the same way. `src/components/ui` holds pieces every module uses: form fields and actions, list filters, list headers and notices, pagination, delete confirmation, audit history, the error panel, the theme toggle and the HUD primitives in `hud.tsx` (`Panel`, `PanelHeader`, `Readout`, `StatusPip`, `DataBlock`, `SysCode`). `src/components/shell` holds the navigation rail and the account menu at its foot (the signed-in name and role, opening upwards to Settings and Sign out). Settings is a hub at `/settings` with two pages: Pipeline (`/settings/pipeline`) and the Odoo import check (`/settings/odoo-import`, `features/odoo`, components in `src/components/settings`). Every page and panel uses these pieces:
- Bordered boxes are `.panel` surfaces with corner ticks.
- Notices are edge-toned strips.
- Record states are status pips from `record-status.tsx`: cyan while active, grey once settled; the label always carries the meaning, and table pips never blink.
- Page headings carry a decorative system string built from real context: the record count on list pages, the record ID prefix on detail pages, NEW or EDIT on forms. `src/components/<module>` holds each area's filters, tables, detail sections and form sections. Page files in `src/app` load data and compose those sections.

The visual style is two daisyUI themes, `avionics-dark` (default) and `avionics-light`, defined in `src/app/globals.css`. They give every daisyUI component square corners, 1px borders and flat depth. Project tokens daisyUI has no slot for are switched by the same `data-theme` attribute: muted and decorative text, the translucent panel surface, corner ticks and the background grid. Cyan, amber and red are reserved for nominal, warning and critical status; system blue is the interactive accent. Fonts are Inter (body copy and figures) and JetBrains Mono (headings, labels, table headers, system strings), loaded with `next/font`. The theme is a `pse-theme` cookie read on the server (`src/lib/theme.ts`), so the first render already uses it. `tests/unit/design-tokens.test.ts` checks both themes for WCAG contrast.

Charts live in `src/components/charts`. They use recharts in client components, which read the live theme colours (`chart-theme.ts`) and follow the dataviz rules:
- One axis per chart.
- An accent hue for the series that matters and grey for context, never status colours as series (accent against grey validated for colour-vision deficiency in both themes).
- Thin bars and lines, square ends, hairline grids.
- A legend for two or more series and selective direct labels.
- Every chart in a `ChartFrame`, a named `<figure>` whose plot is hidden from assistive technology and mirrored by a visually hidden table.

The home dashboard is assembled by `features/overview/context.ts`. It reads the team report and then each module's own service, so every read keeps that module's access rules: the user's upcoming meetings and open activities, recent contributions, deals closing in 30 days and the contact count. The report is required; each queue panel loads and fails on its own, and Next.js redirect signals are re-thrown rather than caught. Its components live in `src/components/overview` and reuse the Reports figures.

Quarter targets for the Reports charts come from the plan through the targets service (`reportPlan` and `features/reports/quarters.ts`), using the report's own target rule; no migration was needed.

Account management lives in `features/accounts`, used only by a superadmin (the `admin` role). Profile reads and changes go through security-definer SQL functions with the caller's own client (migration 0016). Creating and deleting sign-ins and setting passwords need the Supabase Auth admin API, so `src/lib/supabase/admin.ts` creates a service-role Auth client on the server for those three calls only, after the service has verified the superadmin; without `SUPABASE_SERVICE_ROLE_KEY` it returns null and the screen keeps working for profile edits. The pages are `/settings/accounts` and `/settings/accounts/[id]`.

The Odoo import lives in `features/odoo`. `dry-run.ts` checks parsed CSV rows against the module schemas and keeps each clean row's values and resolved links; `import-plan.ts` turns a check with nothing to review into rows with new IDs and links; `reference.ts` loads what the check compares against (shared by the app, with the caller's client, and the command line, with the service-role client). The import route repeats the check on the server, then `import_odoo` (migration 0017) inserts every row in one transaction under RLS.

The top-left logo (`src/components/shell/wordmark.tsx`) is "PSE // CRM" set in Nasalization (Typodermic Fonts) and converted to SVG outlines. Its free licence covers static lettering such as logos and outlined SVG but not embedding the font, so no font file is in the repository or served.

Two guardrails keep files in this shape: `npm run lint` also runs Prettier's check, and ESLint warns when a source file in `src` passes 300 lines.

## Database boundaries

- Contacts represent individuals and companies, with structured company relationships and normalized communication identifiers.
- Configurable pipeline stages, contribution categories and target verticals retain provisional labels until PSE confirms terminology.
- Opportunities store positive expected financial value, company points of contact and a separate optional operational budget.
- Meetings and activities retain their own canonical records. An activity may link to other CRM records or retain person/organization context independently.
- Recognized contributions store actual amounts with explicit employee attribution and an optional target vertical. Opportunity stage/value changes do not create realized contributions.
- Target plans contain the annual amount, four stored quarterly baselines and employee × quarter × vertical allocations. Approval reconciles these levels atomically; approved plans are immutable.
- Database triggers retain audit history, validate relationships and update timestamps. Audit records are readable by permitted PSE users and cannot be written directly by application clients.

Money uses finite PostgreSQL decimal values and explicit currencies. Financial reports must group by currency; no exchange rates or mixed-currency totals are implied. Significant in-kind amounts are manually entered from the operational team's agreed valuation, with supporting context. There is no automated market-value calculation.

## Local verification and hosted integration

The local database workflow uses PGlite's PostgreSQL engine to apply the SQL migrations and exercise constraints, security policies and seed data. Its isolated Auth schema and identity fixtures support database tests only; they do not implement Supabase sign-in, sessions or JWT verification.

The developer reports configuring a Supabase project and applying migrations/RLS. Project values stay in ignored `.env.local`; no credentials are included in the repository. Automated checks cover mocked Auth behavior and anonymous browser access; live demo-account sign-in, refresh, revocation and hosted role behavior remain manual verification. Generated database types describe the migrated local catalog rather than a new hosted introspection.

Reporting and its permission-scoped cache are described in the Phase 11 and Phase 12 sections below; KPI definitions are in [reporting definitions](09-reporting-definitions.md).

Editable diagrams: [system boundaries](diagrams/architecture.mmd), [entity relationships](diagrams/entity-relationships.mmd) and [target approval](diagrams/target-allocation-flow.mmd). See [database schema](03-database-schema.md), [permissions](04-api-and-permissions.md) and [verification evidence](07-testing-and-limitations.md) for details.


## Activities workflow

Activities follow page/component → shared schema/service → caller-scoped Supabase repository → RLS/constraint/audit layers. The same validation supports independent and linked entries. Optional free person/organization context is distinct from structured contact identity. Internal contact, opportunity and meeting selectors load current records; direct contacts must be compatible with effective opportunity context (including a meeting-derived deal). Existing reverse guards protect activities when parents change.

The list combines literal notes/remaining-work/person/organization search with type, work category, status, owner, direct links and relevant-date bounds. Pages contain 20 rows ordered by creation descending then ID. Date filters cover Dhaka calendar days and exclude undated work; without those filters undated entries remain visible. Details show current joined contact information and up to 20 audit entries, not historical contact snapshots or aggregate reporting.

Authorized owner/creator/manager edits merge saved values before validation. Only managers assign other active PSE owners; unchanged historical owners are retained. Write payloads exclude identity, audit and financial/legacy estimate fields. Matching-origin JSON mutations and confirmed DELETE use fresh session checks and no-store responses. Migration 0007 permits the same ownership-scoped deletion under RLS. Deletes retain audit snapshots and all parents. Meeting follow-up tasks use these same rows, so no parallel task store or duplicate canonical meeting is created.

The administrative `seed:activities` runner inserts 11 missing stable IDs from a pure dataset builder. It reuses current demo parents when present and falls back to independent work otherwise, preserving existing edits and parent rows. It imports the private administrative client only in scripts; the application uses the caller session. Activity creation, completion, deletion and seeding never write financial contributions, opportunity values or targets.


## Phase 10 financial workflows

`features/contributions` and `features/targets` each own their schemas, caller-scoped repository and service. `features/finance` holds only what both share: the error type, database-error mapping, employee/vertical lookup, access guards and page/API wiring. Pages handle rendering and client forms handle drafts/review; the server verifies membership, identity and manager authority on every operation, alongside SQL grants/RLS. Financial responses are private/no-store. Ordinary application code imports no administrative key; the one exception is account management, below.

Contribution entry starts from a saved opportunity, retaining its currency/type while requiring a separately entered actual amount and recognition time. A two-step review precedes the append-only write. The `record_contribution` invoker RPC binds the recorder to the verified caller and uses a stable submission ID plus a transaction lock: identical retries return the existing ID; changed payload/recorder conflicts. In-kind entries retain their own manual agreement/source, rather than inheriting expected valuation as realized funding. The app preserves explicit employee and optional vertical attribution.

`save_target_draft` is a fixed-search-path, manager-checked definer RPC that locks the plan and replaces its header, four quarters and allocation snapshot in one transaction. Failed child writes roll back the entire change. The client supplies the last observed `updated_at`; stale snapshots return conflict. Child edits also update the parent revision, including direct SQL/REST child changes. `approve_target_draft` checks the reviewed revision under lock before calling existing approval/reconciliation. Approved targets remain immutable. Configuration keeps target verticals separate from contribution categories.

Integer-cent arithmetic supports percentage calculation and display; PostgreSQL decimal values remain canonical. The manager sees the remainder after downward rounding. No automatic residual assignment is hidden. Target detail uses SQL `target_actuals` aggregation over every eligible receipt, avoiding REST row caps. Allocation reads page in 1,000-row chunks up to 4,000 supported cells; a final parent-version check rejects a detail assembled during draft changes. Recognition time uses Asia/Dhaka calendar boundaries. Actuals include unassigned verticals and dimensions with no allocated target; these display as unassigned/no target. Separate currencies and fixed baselines are preserved. This supplies Phase 10 performance views and supplies the transactional basis for the Phase 11 dashboard.


## Phase 11 reporting and Activity context

Dashboard/Reports render through shared report components and a `features/reports` service/repository. A strict year/period/employee/vertical/currency schema feeds one `pse_report` RPC. Its fixed-search-path invoker function verifies active PSE membership, uses existing RLS and assembles a single SQL snapshot with decimal-text sums, stored target baselines, dimension comparisons, pipeline stages/outcomes, work/status/category counts and zero-filled monthly trends. It reads all eligible rows rather than relying on PostgREST result-page limits. No administrative client is used. Phase 12 wraps eligible snapshots in a permission-scoped server cache.

The dashboard supplies overview cards/charts; Reports adds full employee/vertical, stage, owner and trend tables. Stage charts show at most 12 stages while global totals and the detailed table include all matching stages. All financial arithmetic for display remains in integer cents; bar widths are relative and accessible text carries the exact values. Metadata selectors cap at 1,000 permitted profiles/verticals but aggregate totals are not capped. Draft/missing/monthly-target states are explicit.

Activity create/update validation and migration 0010 require a nonblank related person/organization or CRM link. A NOT VALID historical constraint leaves older rows intact, while enforcing every new/updated row. Legacy gaps are shown as correction notices in details/reports. Future fictional activity seeds provide context; no hosted rows are silently repaired. Mutations in Opportunities, Meetings, Activities and Finance invalidate the dashboard/report route trees; Refresh data expires the current user’s report/metadata cache before requesting a fresh authorized snapshot. Dates, filter scopes and unapproved metrics are defined in docs/09.


## Phase 12 cache boundary

Production requests verify the Supabase user/profile before cache construction. A session capture outside cached execution supplies a cookie-free caller-bearer client for SQL misses; its identity must match the verified user. Cache keys encode version/resource, project hash, user, role/department, session fingerprint, filters and a TTL time bucket. Next Data Cache stores 30-second report snapshots and 300-second vertical metadata. Report profile names are redacted before storage, and fresh permitted profile rows hydrate names on every request; access/profile reads are never shared cache entries.

Mutation handlers expire project-wide report tags with blocking `{ expire: 0 }`, plus vertical tags for finance/configuration that affects verticals. Refresh uses a same-origin authenticated POST and expires only that verified user's tags. HTTP responses remain private/no-store. Transactional APIs stay uncached. A server-only false flag bypasses this layer for unverified multi-instance handlers. The local benchmark uses the same service/key policy with isolated PostgreSQL and a measurement store; production cache propagation/HTTP performance remains separate acceptance work.
