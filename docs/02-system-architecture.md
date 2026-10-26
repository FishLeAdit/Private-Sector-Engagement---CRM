# System architecture

The database foundation separates relationship management, expected fundraising, realized contributions and fixed targets. PostgreSQL constraints, row-level security (RLS) and triggers enforce data integrity at the storage boundary. The application implements authentication, Contacts CRUD/deletion, financial Opportunities create/read/edit/delete/stage workflows, Meetings create/read/edit/delete/status with linked follow-up task creation, and Activities create/read/edit/delete/status. Target/contribution-entry UI and reporting remain subsequent checkpoints.

Contacts pages and API handlers call shared feature services. Client/server Zod schemas validate allowed input fields, business services enforce ownership and company/duplicate rules, and a caller-scoped PostgREST repository performs queries under RLS. Database uniqueness remains authoritative when concurrent submissions pass the initial duplicate check. Client duplicate checks are advisory and company suggestions query internal contacts only. Cookie-authenticated contact POST/PATCH requests require a matching Origin and JSON body. Lists use deterministic 20-row pagination; contact data uses no-store access and mutations invalidate affected page paths.

The user-requested DELETE action requires same-origin access and explicit UI confirmation. Creator/manager permissions are enforced in services and migration 0004 RLS. Existing restrictive foreign keys prevent deletion of referenced contacts without cascading work records, and the audit trigger retains the deleted contact's before snapshot and actor. This adds no table columns or administrative-client bypass.

Opportunity deletion uses the same confirmation/API/service/repository layers, with focal-person/creator/manager permission matching the existing opportunity edit policy. Migration 0005 adds the authenticated DELETE grant and matching RLS; the ordinary caller-scoped client remains in use. An atomic FK restriction blocks deletion when meetings, activities or recognized contributions depend on the deal, including relationships added after the initial service read. Reference conflicts become HTTP 409. Contacts remain intact, the database retains the delete snapshot/actor, and successful deletion invalidates the list/board/detail/edit and related Contact route paths.

Opportunities use the same page → feature service → caller-scoped repository boundaries. Services validate positive expected value, company contact people, active selections, owner permissions and manually agreed in-kind valuation. Partial updates merge stored fields before full validation. Existing database guards protect linked meetings/activities and recognized-contribution currency/type. Stage changes use ordinary authorized PATCH requests and existing audit triggers; they never insert received contributions.

The New Deal contact dialog reuses ContactForm and the Contacts API; it is a sibling of the deal form to avoid nested forms. A saved contact is committed independently and selected in the still-open deal draft, without navigation. Settings allows manager-only stage/category configuration under the existing RLS. Loading provisional examples is explicit, adds missing entries and does not overwrite team configuration. Setup uses successive writes, so an interrupted or conflicting setup may be partial and can be retried after refreshing.

The list and board share deterministic 20-row pagination and filters. Board counts and expected-value subtotals describe only the current page, grouping currencies with integer-cent addition. Details read the latest 10 recognized contributions and 20 audit entries; these are recent-record views rather than aggregate reports. Lookup lists are capped at 1,000 entries each. Reads are uncached; mutations invalidate deal/contact paths, and configuration changes invalidate Settings and the Opportunities route tree.

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

Application data caching and reporting endpoints remain unimplemented. Their future access scope, invalidation rules and KPI definitions must match the caller's permissions and the database model.

Editable diagrams: [system boundaries](diagrams/architecture.mmd), [entity relationships](diagrams/entity-relationships.mmd) and [target approval](diagrams/target-allocation-flow.mmd). See [database schema](03-database-schema.md), [permissions](04-api-and-permissions.md) and [verification evidence](07-testing-and-limitations.md) for details.


## Activities workflow

Activities follow page/component → shared schema/service → caller-scoped Supabase repository → RLS/constraint/audit layers. The same validation supports independent and linked entries. Optional free person/organization context is distinct from structured contact identity. Internal contact, opportunity and meeting selectors load current records; direct contacts must be compatible with effective opportunity context (including a meeting-derived deal). Existing reverse guards protect activities when parents change.

The list combines literal notes/remaining-work/person/organization search with type, work category, status, owner, direct links and relevant-date bounds. Pages contain 20 rows ordered by creation descending then ID. Date filters cover Dhaka calendar days and exclude undated work; without those filters undated entries remain visible. Details show current joined contact information and up to 20 audit entries, not historical contact snapshots or aggregate reporting.

Authorized owner/creator/manager edits merge saved values before validation. Only managers assign other active PSE owners; unchanged historical owners are retained. Write payloads exclude identity, audit and financial/legacy estimate fields. Matching-origin JSON mutations and confirmed DELETE use fresh session checks and no-store responses. Migration 0007 permits the same ownership-scoped deletion under RLS. Deletes retain audit snapshots and all parents. Meeting follow-up tasks use these same rows, so no parallel task store or duplicate canonical meeting is created.

The administrative `seed:activities` runner inserts 11 missing stable IDs from a pure dataset builder. It reuses current demo parents when present and falls back to independent work otherwise, preserving existing edits and parent rows. It imports the private administrative client only in scripts; the application uses the caller session. Activity creation, completion, deletion and seeding never write financial contributions, opportunity values or targets.
