# System architecture

The database foundation separates relationship management, expected fundraising, realized contributions and fixed targets. PostgreSQL constraints, row-level security (RLS) and triggers enforce data integrity at the storage boundary. The Next.js application remains a scaffold; login, server services and working CRM screens are subsequent checkpoints.

## Application and deployment

The selected deployment design is browser → Next.js on Vercel → Supabase Auth and PostgreSQL. This stack and deployment platform are implementation choices, not mandates established by the supplied Word assessment. Any separate platform requirement needs verification against the recruitment email.

Pages display UI, components provide reusable elements, `features/*` owns validation and business services, and `lib/supabase/*` owns database connections. Future route handlers and server actions must validate the authenticated identity, call shared services and use a caller-scoped Supabase client. RLS is an additional database boundary; hiding UI controls is insufficient authorization.

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

A configured Supabase project, real Auth identities and hosted migration/policy verification are still required before using private CRM data. No hosted project or credentials are included in the repository. Generated database types describe the migrated local catalog; they are not evidence that the schema has been deployed to Supabase.

Application data caching and reporting endpoints remain unimplemented. Their future access scope, invalidation rules and KPI definitions must match the caller's permissions and the database model.

Editable diagrams: [system boundaries](diagrams/architecture.mmd), [entity relationships](diagrams/entity-relationships.mmd) and [target approval](diagrams/target-allocation-flow.mmd). See [database schema](03-database-schema.md), [permissions](04-api-and-permissions.md) and [verification evidence](07-testing-and-limitations.md) for details.
