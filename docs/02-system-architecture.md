# System architecture

The database foundation separates relationship management, expected fundraising, realized contributions and fixed targets. PostgreSQL constraints, row-level security (RLS) and triggers enforce data integrity at the storage boundary. The Next.js application implements Supabase login/logout, session refresh and active PSE access checks; CRM business services/screens remain subsequent checkpoints.

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
