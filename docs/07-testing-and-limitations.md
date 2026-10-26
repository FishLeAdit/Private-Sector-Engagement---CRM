# Testing and limitations

The database foundation is implemented and locally verified. The web interface, HTTP APIs and Auth integration remain scaffolds. Database evidence below does not imply a completed CRM workflow or hosted deployment.

## Database verification on 26 October 2026

| Command | Result |
|---|---|
| `npm test` | 43 tests passed across contacts/access, financial integrity and target approval |
| `npm run validate:seed` | Migrations and fictional seed applied successfully; reconciliation, financial totals and basic role checks passed |
| `npm run db:types:check` | Generated types matched all 13 migrated tables |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm run build` | Passed with Next.js 16.4.3 |

Tests execute actual SQL using PostgreSQL 18.6 through PGlite 0.5.11. Each suite gets a fresh database, with a local-only Auth identity adapter supplying `auth.users`, `auth.uid()` and database roles. No hosted Supabase project, JWT verification, browser session or real login account was tested. Do not deploy the adapter as application authentication.

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

- Hosted Supabase migration/RLS verification and real Auth sessions are pending. The local engine uses PostgreSQL 18; verify compatibility against the selected hosted PostgreSQL version when integrating.
- Parent-row locks serialize target edits and approval in the SQL design. The single-connection local harness does not prove multi-session race behavior; add a two-session hosted/local-server test during integration.
- No working CRM forms/services, dashboard queries, contacts-engaged KPI, cache, deployment or browser E2E suite exist yet. E2E files remain placeholders and were not run.
- Phone normalization strips formatting only; it does not infer country codes, leading-zero rules or extensions. Imports/entry must use consistent international numbers and review ambiguous matches.
- Currency codes are syntactically uppercase three-letter identifiers; no exchange rates, currency conversion or full currency registry is implemented.
- Percentage entry/rounding is a later application workflow; canonical allocation amounts are stored once. Final pipeline stages, vertical mappings and reporting formulas remain provisional.
- Refund/contribution correction and deletion workflows are not implemented. Application clients cannot edit/delete realized contributions or approved targets.
- The seed contains fixed fictional Auth/profile identifiers, not login credentials. Hosted import requires trusted identity provisioning and reviewed mappings. No real JAAGO/Odoo data was migrated.

## Earlier scaffold verification

On 26 October 2026, local production-server HTTP smoke checks confirmed root/sign-in, dashboard, contact list/new/detail placeholders returned HTTP 200 and the contacts API returned HTTP 501. These were scaffold checks; they did not verify contact forms, login or private data access.

See [the local test guide](06-user-guide.md) for reproducible commands.
