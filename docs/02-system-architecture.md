# System architecture

The database foundation separates relationship management, expected fundraising, realized contributions and fixed targets. PostgreSQL constraints, row-level security (RLS) and triggers enforce data integrity at the storage boundary. The application implements authentication, Contacts CRUD/deletion and financial Opportunities create/read/edit/stage workflows; other CRM modules remain subsequent checkpoints.

Contacts pages and API handlers call shared feature services. Client/server Zod schemas validate allowed input fields, business services enforce ownership and company/duplicate rules, and a caller-scoped PostgREST repository performs queries under RLS. Database uniqueness remains authoritative when concurrent submissions pass the initial duplicate check. Client duplicate checks are advisory and company suggestions query internal contacts only. Cookie-authenticated contact POST/PATCH requests require a matching Origin and JSON body. Lists use deterministic 20-row pagination; contact data uses no-store access and mutations invalidate affected page paths.

The user-requested DELETE action requires same-origin access and explicit UI confirmation. Creator/manager permissions are enforced in services and migration 0004 RLS. Existing restrictive foreign keys prevent deletion of referenced contacts without cascading work records, and the audit trigger retains the deleted contact's before snapshot and actor. This adds no table columns or administrative-client bypass.

Opportunities use the same page → feature service → caller-scoped repository boundaries. Services validate positive expected value, company contact people, active selections, owner permissions and manually agreed in-kind valuation. Partial updates merge stored fields before full validation. Existing database guards protect linked meetings/activities and recognized-contribution currency/type. Stage changes use ordinary authorized PATCH requests and existing audit triggers; they never insert received contributions.

The New Deal contact dialog reuses ContactForm and the Contacts API; it is a sibling of the deal form to avoid nested forms. A saved contact is committed independently and selected in the still-open deal draft, without navigation. Settings allows manager-only stage/category configuration under the existing RLS. Loading provisional examples is explicit, adds missing entries and does not overwrite team configuration. Setup uses successive writes, so an interrupted or conflicting setup may be partial and can be retried after refreshing.

The list and board share deterministic 20-row pagination and filters. Board counts and expected-value subtotals describe only the current page, grouping currencies with integer-cent addition. Details read the latest 10 recognized contributions and 20 audit entries; these are recent-record views rather than aggregate reports. Lookup lists are capped at 1,000 entries each. Reads are uncached; mutations invalidate deal/contact paths, and configuration changes invalidate Settings and the Opportunities route tree.

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
