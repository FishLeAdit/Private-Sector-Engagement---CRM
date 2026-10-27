# API and permissions

Database authorization is implemented in grants, row-level security (RLS), validated target approval and triggers. Authentication, Contacts, Opportunities, Meetings and Activities HTTP handlers are implemented, including a narrow linked follow-up task endpoint. Contributions and Targets are now implemented; Reports is now implemented with a caller-scoped read-only aggregate.

## HTTP and session behavior

- `/login` accepts email/password through a Next.js Server Action with server-side validation. Supabase verifies the credentials; shared access logic verifies the user and current profile before granting entry. Failed membership checks attempt to sign out the newly created session. No public signup or profile/role editor is provided.
- `/` redirects to `/dashboard`, `/access-denied` or `/login` according to verified access. The login return path is restricted to workspace routes and cannot redirect to an external site.
- Proxy refreshes/verifies tokens with `getClaims()` and preserves refreshed cookies across redirects. Protected page rendering and all API GET handlers independently verify the current user/profile. Future business services must call the guard before accessing data; layout checks alone are insufficient.
- Anonymous API callers receive JSON 401; authenticated callers without active PSE membership receive 403; identity/profile service failures produce 503 and never grant access. Authorized Contacts/Opportunities/Meetings/Activities/Contributions/Targets calls return data or validation/conflict errors; Reports calls return a read-only aggregate or a safe validation/availability error. Unsupported methods have no implemented mutation.
- `authorizeApi({ manager: true })` provides the server-side manager check for future target mutations. Existing target GET access remains team-wide; target writes still require RLS/approval validation.
- Auth responses use private/no-store headers and Supabase server fetches bypass caching. Cookie-session refresh is implemented; ordinary CRM requests use no administrative/service-role client. The separate explicitly run demo-seed CLI is administrative tooling. Sign out affects the current session and reports failure instead of claiming success if the provider rejects it.

## Membership and trusted administration

A CRM caller must have an active `profiles` record in the PSE department. Proposed roles are `pse_member`, `pse_manager` and `admin`; manager permissions do not admit an inactive or non-PSE profile. Authentication alone does not establish PSE membership.

Application clients cannot create profiles or change their own role, department or active flag. A trusted database/Supabase administrator provisions the corresponding Auth identity and profile. No client-accessible signup trigger grants CRM membership, and no demo login credentials are committed.

## Contacts API contract

| Endpoint | Behavior |
|---|---|
| `GET /api/contacts` | `{ contacts, count }`; optional `q`, `kind=all/individual/company`, `company_id`, and one-based `page`; 20 rows per page, stable name/ID ordering |
| `POST /api/contacts` | Validate/create a contact; returns HTTP 201 with `{ contact }` |
| `GET /api/contacts/[id]` | Return `{ contact }`; invalid UUID is 400 and missing record is 404 |
| `PATCH /api/contacts/[id]` | Validate/merge a partial update; only the creator or active PSE manager/admin can edit; returns `{ contact }` |
| `DELETE /api/contacts/[id]` | Delete one unreferenced contact as creator or active PSE manager/admin; returns `{ deleted: true, id }`; linked references return HTTP 409 |
| `POST /api/contacts/duplicates` | Read-only preflight with `email`, `phone` and optional edited-contact `exclude` UUID; returns matching IDs/names and matched fields |

Contact input fields are `kind`, `name`, `email`, `phone`, `company_id`, `designation`, `website`, `industry` and `notes`. Optional form strings use empty values when omitted; writes store null where appropriate. At least email or phone is required for individuals and companies. Email is trimmed/lowercased; phone comparison uses digits without inferring country codes. Company links must point to existing company records. Type and creator identity cannot be changed through PATCH. Unknown/identity fields are rejected rather than mass-assigned.

Cookie-authenticated POST/PATCH calls require a JSON content type and an Origin matching the application request URL. Browser form fetches supply it automatically; manual API clients must supply the matching Origin. Responses are private/no-store. Validation errors return 422 with field messages; duplicate conflicts return 409 and may include links to existing contacts. Database unique violations are mapped to the same safe conflict error when a race passes preflight. Malformed JSON returns 400, unsupported content type 415 and oversized form bodies 413. Raw database error details are not sent to clients.

DELETE also requires the matching Origin but needs no request body. The detail page asks for explicit confirmation before sending it. The service verifies the caller and creator/manager permission, and migration 0004 enforces the same predicate under RLS. Existing FK RESTRICT checks are authoritative if relationships are added concurrently; PostgreSQL `23001`/`23503` reference conflicts map to HTTP 409. Successful deletes retain the existing audit snapshot/actor and invalidate list/detail/edit paths. No linked records are cascaded or automatically unlinked. The UI confirmation is an interaction safeguard, not a replacement for backend authorization.

List search matches name/email/phone/industry/designation with quoted literal filters; wildcard `*` input is rejected. Company/workplace filtering uses a structured company ID. Company suggestions use this authenticated list API and only query internal contacts. Recent detail history reads up to 10 linked opportunities, 10 meetings and 20 activities; indirect history is limited to the recent parent records shown. This is not a complete historical reporting export. New Deal's inline contact creation uses the same POST endpoint and duplicate rules.

## Opportunities API contract

| Endpoint | Behavior |
|---|---|
| `GET /api/opportunities` | `{ opportunities, count }`; optional `q` (deal name), `stage_id`, `owner_id`, `contribution_category_id`, `contribution_type`, `contact_id`, `currency`, `from`/`to` expected-closing dates and one-based `page`; 20 rows ordered by creation descending then ID |
| `POST /api/opportunities` | Create a financial deal; HTTP 201 `{ opportunity }` |
| `GET /api/opportunities/[id]` | `{ opportunity, history }`; latest 10 recognized contributions and 20 audit entries; invalid UUID 400, absent record 404 |
| `PATCH /api/opportunities/[id]` | Merge and validate a nonempty partial update; `{ opportunity }`; stage moves send only `stage_id` |
| `DELETE /api/opportunities/[id]` | Delete an unlinked opportunity as focal person, creator or active PSE manager/admin; `{ deleted: true, id }`; linked meetings/activities/recognized contributions return HTTP 409 |
| `GET /api/opportunities/options` | `{ stages, categories, owners }`; includes inactive historical selections, with up to 1,000 rows per lookup; profiles restricted to permitted PSE roles |
| `POST /api/opportunities/configuration` | Manager-only `{ entity: "stage" or "category", id?: UUID, values }` creates/updates configuration; `{ entity: "starter" }` adds missing provisional assessment examples; returns the options object |

Required deal input: `deal_name`, `contact_id`, `owner_id`, `stage_id`, `contribution_type` (`cash`/`valued_in_kind`), `contribution_category_id` and positive `expected_amount`; currency defaults to BDT. Optional fields are `primary_contact_id`, `secondary_contact_id`, nonnegative `operational_budget`, `payment_interval`, `expected_close_at`, `country`, `description`, `notes`, `drive_urls`, `valuation_note` and `valuation_reference_url`. Company parties require an individual primary contact; secondary is optional and distinct. Individual parties use themselves as the point of contact. In-kind deals require a nonblank agreed valuation note. HTTP(S) references are supported; no uploads or external autofill are performed. Unknown identity/audit fields are rejected; the service supplies `created_by` from verified access.

Team reads remain PSE-wide. Focal person, creator or manager can edit; only managers assign another focal person or configure stages/categories. These are project policy choices consistent with existing RLS. New/changed owners must be active PSE users; new/changed stage/category selections must be active. Historical unchanged selections remain editable. Existing recognized contributions prevent incompatible currency/type edits; linked meeting/activity contacts prevent incompatible party/contact edits.

POST/PATCH requests require the matching Origin, JSON content type and at most 65,536 characters. DELETE requires the matching Origin and needs no body. Responses are private/no-store. Validation/integrity errors return 422, unavailable services 503, permission errors 403 and duplicate configuration names/codes/positions 409. Raw provider details are scrubbed. Stage settings use `name`, unique integer `position`, `outcome` (`open`, `won`, `lost`, `abandoned`, `junk`), `active` and `is_provisional`; closed flags are derived server-side. Category settings use `code`, `name`, `active`, `is_provisional`. Entries are deactivated rather than deleted. Example setup is not atomic; refresh/retry can fill missing entries after a partial failure. No endpoint records actual achievement from a stage move or changes target verticals.

DELETE uses the same ownership predicate in the service and migration 0005 RLS. It deletes only the validated requested UUID and verifies the returned ID; zero affected rows return 403 after a successful initial read. Missing/invalid IDs return 404/400. FK RESTRICT conflicts (`23001`/`23503`) map to a safe 409 message, with no cascade or automatic unlink. Recognized contributions remain append-only and must be retained with their opportunity. Contacts and opportunity audit snapshots are retained. Successful deletion invalidates opportunity list/board/detail/edit paths and linked contact history. UI confirmation names the deal, disables duplicate submission/cancellation while pending, and keeps errors visible when deletion fails.

## Meetings API contract

| Endpoint | Behavior |
|---|---|
| `GET /api/meetings` | `{ meetings, count }`; filters `q` (title), `status`, `period`, `owner_id`, `contact_id`, `opportunity_id`, `from`, `to`, and one-based `page`; 20 rows ordered by scheduled time then ID |
| `POST /api/meetings` | Create a linked meeting; HTTP 201 `{ meeting }`; creator comes from verified access |
| `GET /api/meetings/[id]` | `{ meeting, history }`; latest 20 directly linked activities and 20 meeting audit entries |
| `PATCH /api/meetings/[id]` | Merge/full-validate a nonempty partial update; `{ meeting }`; status updates can send only `status` |
| `DELETE /api/meetings/[id]` | Owner/creator/active PSE manager deletion of an unlinked meeting; `{ deleted: true, id }`; linked activities/follow-ups return 409 |
| `GET /api/meetings/options` | `{ owners, contact, opportunity }`; optional known `contact_id`/`opportunity_id`; internal details include designation/workplace and designated opportunity contact people; owners capped at 1,000 permitted PSE profiles |
| `POST /api/meetings/[id]/follow-ups` | Create an open task in `activities` using inherited meeting/contact/opportunity links; HTTP 201 `{ activity }` |

Meeting input requires `title`, `owner_id` and `scheduled_at` as an ISO instant with a timezone offset or `Z`. `contact_id` and `opportunity_id` use UUIDs or empty strings; at least one must be set. Status defaults to `scheduled` and supports `scheduled`, `done`, `cancelled`; description defaults empty and is stored as null when cleared. An opportunity-only meeting keeps its explicit contact null; UI contact information derives from the opportunity's primary contact or party. Company and individual direct contacts are supported. When both IDs are set, the contact must be the opportunity party or designated primary/secondary person. Unknown identity/audit fields are rejected.

Owners/creators/managers may edit or delete under RLS; ordinary members create for themselves and only managers assign another active PSE owner. Historical unchanged owners need not remain active for an authorized editor, but an inactive/non-PSE caller is always denied. Contact/opportunity parent changes must preserve existing linked activities. Title, owner, Cancelled and deletion are project choices, while Scheduled/Done, contact information, event date/time and description reflect the assessment.

Meeting DELETE requires the matching Origin and no body. The service verifies access and the requested UUID, the repository scopes deletion to that ID and checks the affected row, and migration 0006 enforces the same ownership predicate. Missing/invalid IDs return 404/400; stale zero-row access returns 403. FK RESTRICT failures (`23001`/`23503`) return safe HTTP 409 without cascades/unlinking. Audit snapshots and parent contacts/opportunities are retained. The confirmation disables repeat submissions and cancellation/Escape while pending. Successful deletion invalidates meeting and related record paths and returns to the list with confirmation.

List `status` is `all`, `scheduled`, `done` or `cancelled`; `period` is `all`, `upcoming` or `completed`. Upcoming adds Scheduled and event time at/after the server request clock. Completed adds Done independently of the event date. All filters combine with AND, so contradictory View/Status choices return no rows. Date filters are inclusive Dhaka calendar days, using an exclusive next-day upper bound. `contact_id` matches only the explicit meeting contact, including when an opportunity-only row displays derived contact information; `opportunity_id` matches the saved opportunity link. Literal title search escapes SQL wildcards and rejects `*`.

Follow-up input is required trimmed `notes`, optional `occurred_at` (offset/Z instant or empty) and optional `owner_id` (UUID or empty). The server fixes `activity_type = task`, `status = open`, `work_category = independent_general`, creator and inherited links; callers cannot replace these fields. Ownership defaults to the caller. Any active PSE member may create their own task on a colleague's visible meeting; only managers assign another active PSE employee. The optional timestamp is relevant work time, not a dedicated due-date field. Creating follow-ups does not mark the meeting Done, create financial achievement, or duplicate meeting records. The resulting task can be edited, completed and deleted in Activities.

All responses use private/no-store headers. POST/PATCH requires matching Origin, JSON content type and a body of at most 65,536 characters; DELETE needs the matching Origin and no body. Invalid meeting IDs return 400, missing meetings 404, validation/link conflicts 422, deletion reference conflicts 409, permission failures 403, unsupported content type 415, oversized input 413, and unavailable providers 503. Raw database details are scrubbed. Existing database guards remain authoritative if ownership or relationships change between reads and writes. Successful mutations invalidate the meeting list/detail/edit and related Contacts/Opportunities/Activities route paths. The configured project has migration 0006 and six administratively seeded demo meetings; end-user JWT/browser acceptance remains manual. Completed test results appear in [testing and limitations](07-testing-and-limitations.md).

## Access matrix

| Data or action | Anonymous / non-PSE / inactive | Active PSE member | Active PSE manager/admin |
|---|---|---|---|
| Read permitted CRM records and audit history | Denied | Team-wide read; profiles restricted to PSE | Team-wide read; profiles restricted to PSE |
| Create ordinary contact/opportunity/meeting/activity records | Denied | Own authenticated records under ownership checks | Same checks |
| Edit ordinary operational records | Denied | Own records under creator/owner policies | Manager edits allowed subject to integrity checks |
| Create a meeting-linked follow-up task | Denied | Own task on any visible meeting | May assign another active PSE employee |
| Delete an unreferenced contact | Denied | Own records only | Any contact, subject to FK restrictions |
| Delete an unlinked opportunity | Denied | Focal person or creator, subject to FK restrictions | Any opportunity, subject to FK restrictions |
| Delete an unlinked meeting | Denied | Owner or creator, subject to activity/follow-up FK restrictions | Any meeting, subject to the same restrictions |
| Delete other operational CRM records | Denied | Denied through application grants | Denied through application grants |
| Record a realized contribution | Denied | Authenticated recorder; credited to themselves; deal open or won | Any active employee; deal open or won |
| Edit/delete a recognized contribution | Denied | Denied | Denied through application grants |
| Configure stages, categories and target verticals | Denied | Denied | Allowed subject to constraints |
| Create/edit draft target data and approve a plan | Denied | Denied | Allowed subject to reconciliation |
| Change approved target data | Denied | Denied | Denied |
| Directly insert/edit/delete audit history or membership | Denied | Denied | Denied through application grants |

RLS applies to every CRM table. Explicit table/function grants restrict the operations available before row policies are considered. A privileged database owner or Supabase service role is outside the end-user RLS boundary; never expose such credentials to the browser or use them as a substitute for caller-scoped application access.

## Target approval contract

`public.approve_target_plan(p_plan_id uuid) returns uuid` is the database operation for approving a draft annual plan; the result is the approved plan ID. It verifies active manager membership, locks the parent plan and checks annual → quarter → employee/vertical reconciliation. A direct draft-to-approved status update must satisfy the same trigger validation. Related row changes take the same lock, so approval and edits cannot race past each other. An approved plan's header, quarterly baselines and allocation grid remain immutable; approval metadata and audit records retain the change history.

The application must not treat a successful form calculation as approval. Database rejection is authoritative. Current APIs do not expose this RPC through a working UI or custom HTTP endpoint.

## Mutation integrity

Insert policies bind creator/recorder identity to the authenticated caller; updates cannot rewrite origin identity. Members cannot transfer record ownership to gain edit access; authorized managers may assign ownership under the database guards. Relationship checks reject incompatible party/contact/opportunity/meeting links and invalid PSE owners. Database constraints retain both company points of contact, optional budgets, independent activity context and manually agreed in-kind values.

Opportunities and budgets are forecasts/context, not recognized contributions. Valued in-kind mutations require explanatory notes; operational-team estimate references may be stored as HTTP(S) URLs. Clients cannot cause automatic market valuation, infer realized achievement from a stage transition, or alter historical contribution attribution.

Timestamp and audit triggers run at the database boundary. Audit actor identity comes from the request context rather than a client-supplied audit body. Membership helpers are `private.is_pse_member()` and `private.is_target_manager()`. Internal privileged functions use explicit search paths and restricted execution rights; helper functions are not an alternate route around policy checks.

## Local policy tests and remaining work

Local verification runs SQL under isolated database roles and request identities. It exercises database rules, not real Supabase JWT validation or session cookies. The seed uses fixed fictional profile IDs whose Auth identity rows are supplied by the local test bootstrap. It does not create Supabase users, passwords or real login accounts. A hosted import would require trusted identity provisioning and a reviewed mapping rather than copying the bootstrap. No hosted deployment is part of this checkpoint.

Authentication helpers, actions and proxy behavior have mocked unit coverage; anonymous browser routes/APIs have E2E coverage. The developer chose to verify live sign-in manually, so real-credential login/logout and refresh have not been claimed as tested here. Future business route handlers/server actions must validate inputs and call shared services with the caller's database context and required manager guard. See [testing and limitations](07-testing-and-limitations.md) for evidence and [the user guide](06-user-guide.md) for manual sign-in steps.


## Activities API contract

| Endpoint | Behavior |
|---|---|
| `GET /api/activities` | `{ activities, count }`; `q` searches notes/remaining work/person/organization, plus `activity_type`, `work_category`, `status`, `owner_id`, direct `contact_id`/`opportunity_id`/`meeting_id`, Dhaka `from`/`to` dates and one-based `page`; 20 rows, newest created then ID |
| `POST /api/activities` | Validated independent or linked activity; HTTP 201 `{ activity }`; creator fixed from verified identity |
| `GET /api/activities/[id]` | `{ activity, audits }`; current contact/opportunity/meeting joins, latest 20 audits; invalid ID 400, missing row 404 |
| `PATCH /api/activities/[id]` | Nonempty partial update merged with existing values; `{ activity }`; owner/creator/manager only |
| `DELETE /api/activities/[id]` | Same ownership policy, matching Origin, no body; `{ deleted: true, id }`; retains parent records/audit snapshots |
| `GET /api/activities/options` | `{ owners, contact, opportunity, meeting }`; optional three relationship IDs, internal lookups and at most 1,000 PSE owners including historical inactive choices |

Required create fields: `activity_type`, `owner_id`, nonblank `notes` (10,000 characters). Category defaults to `independent_general`, status to `open`. Optional strings: `contact_id`, `opportunity_id`, `meeting_id`, `related_person_name`, `related_organization_name`, `remaining_work`, `occurred_at`; optional `drive_urls` holds up to 20 HTTP(S) URLs. Form/API empty strings clear nullable fields. Person/organization text is context, not a CRM identity. All links can be absent when a related person or organization is provided. Relevant time accepts a zoned ISO instant and stores UTC; no date is required. Legacy blank-note records must receive descriptive notes when updated.

Type keys: `task`, `email`, `call`, `meeting`, `event`, `campaign`, `proposal`, `visit`, `stewardship`, `prospect_engagement`, `general`. Work categories: `stewardship`, `prospect_engagement`, `independent_general`. Statuses: `open`, `in_progress`, `done`, `cancelled`. List type/category/status filters also accept `all`; filters combine with AND. Direct-link filters exclude context obtained only through another linked parent. Date bounds use `occurred_at`, include whole Dhaka days, and exclude null dates. Search treats SQL wildcard characters literally and rejects `*`.

Only managers assign another active owner; unchanged historical owners are preserved for an authorized editor. A direct contact must be the opportunity party/designated contact where an effective direct or meeting-derived opportunity exists. Meeting and opportunity links cannot contradict each other; a contact-only meeting's contact must be compatible if paired with a deal. Missing references and validation conflicts return 422. SQL guards remain authoritative after service checks.

POST/PATCH requires matching Origin, JSON and at most 65,536 characters; DELETE requires matching Origin and no body. Invalid fields/links return 422, permissions 403, missing IDs 404, malformed IDs/JSON 400, unsupported type 415, oversized input 413 and provider failures 503. A future FK reference conflict on delete maps to 409; a zero-row write after a permissions change returns 403. Raw database messages are scrubbed. All responses are private/no-store. Successful writes invalidate Activities list/detail/edit and Contacts/Opportunities/Meetings layouts. Identity, audit, financial and `estimated_nonmonetary_value` mass assignment is rejected; legacy estimates remain untouched by status/detail edits. No activity status transition writes financial achievement.


## Phase 10 financial APIs

| Endpoint | Behavior |
|---|---|
| `GET /api/contributions` | `{ contributions, count }`; direct opportunity/employee/vertical/currency and recognition `from`/`to` filters, one-based page; 20 rows by recognition descending then ID |
| `POST /api/contributions` | Review-validated receipt with stable `request_id`; `{ contribution }` on first save or identical retry (HTTP 200) |
| `GET /api/contributions/[id]` | `{ contribution }` with opportunity, employee, vertical and recorder; no PATCH/DELETE methods |
| `GET /api/targets` | `{ plans, count }`; one-based page, 20 plans by year descending/currency |
| `POST /api/targets` | Manager snapshot save with `request_id` and empty initial `expected_updated_at`; `{ id }` |
| `GET /api/targets/[id]` | `{ plan, allocations, actuals, audits }`; fixed baselines and SQL-aggregated achievement |
| `PATCH /api/targets/[id]` | Manager full draft snapshot; path equals `request_id`, existing `expected_updated_at` required for a successful update; `{ id }` |
| `POST /api/targets/[id]/approve` | Manager-only `{ expected_updated_at }`; atomic version-checked reconciliation/lock; `{ id }` |
| `GET /api/targets/options` | Up to 1,000 permitted PSE employees and 1,000 configured verticals, including inactive historical choices |
| `POST /api/targets/verticals` | Manager-only `{ id?, values: { code, name, active, is_provisional } }`; `{ id }` |

Receipt fields: `request_id`, `opportunity_id`, `employee_id`, optional/empty `target_vertical_id`, decimal-text positive `amount`, `currency`, `contribution_type`, zoned `recognized_at`, optional `approved_value_note`, `valuation_reference_url`, `notes`. In-kind requires a nonblank agreement/source note. Unknown identity/audit fields are rejected; recorder is bound in SQL. Currency/type must match the saved opportunity; employee/selected vertical must be active. The opportunity must be open or won: a Lost, Abandoned or Junk deal returns 422, while receipts recorded before a deal closed stay valid and closing such a deal is not blocked (service and migration 0012). A member may only credit themselves (403 otherwise); a PSE manager or admin may credit any active employee (service and the migration 0013 RLS policy). Attribution is explicit, optional vertical stays unassigned, and no expected amount is automatically realized. Identical retry IDs/payloads are idempotent; changed submissions conflict. The UI freezes ambiguous submissions and allows retrying the same snapshot.

Target snapshots contain `request_id`, `expected_updated_at`, year, currency, decimal annual amount, exactly four unique `{ quarter, amount }` objects and up to 4,000 `{ quarter, employee_id, vertical_id, amount }` cells. Duplicate dimension cells, extra fields, invalid money and unsupported years are rejected. Draft totals may be incomplete; approval requires full reconciliation and active dimensions. Application and database checks enforce manager-only writes. Approved targets are immutable, and stale snapshots/approvals return 409. The actual aggregate uses all same-currency contributions recognized in the plan year under Asia/Dhaka; no currency conversion or allocation-based exclusion is applied.

All responses are private/no-store. Writes require a matching Origin and JSON, with a maximum of 1,000,000 characters for allocation snapshots. Errors: validation 422, malformed JSON/ID 400, missing record 404, permission 403, stale/duplicate conflict 409, unsupported content type 415, oversized request 413, unavailable provider 503. Raw database details are scrubbed. Successful writes invalidate Contributions/Targets/Opportunities/Dashboard/Reports layouts. No refund, correction, deletion or broad target-edit hierarchy is implied by these endpoints.


`seed_demo_target` is administrative fixture tooling only. It is not used by the Targets API and cannot be executed by anonymous or authenticated application users, including PSE managers. Only the service-role CLI may insert the two reserved draft demo IDs; existing plans are preserved and approval still requires a real authorized user. No private administrative key is imported by the app.


## Reports API

`GET /api/reports` returns `{ filters, report }` with private/no-store headers. Optional filters: year (1–9998; defaults to the current Dhaka year), period (`year`, `q1`–`q4`, `m01`–`m12`; defaults to year), `employee_id` (UUID or empty), `vertical_id` (UUID, `unassigned` or empty), and three-letter `currency` (defaults to BDT, normalized uppercase). Unknown fields, malformed IDs/periods and mixed-currency input return 422. The endpoint implements no mutation methods.

The service verifies fresh allowed PSE identity/profile equality; the repository uses the ordinary caller client. `pse_report` checks PSE membership again and uses RLS. Anonymous/restricted/unavailable states return 401/403/503; provider details are scrubbed. Report payload includes generation time, exclusive-end period boundaries, targets/actual/type/dimension comparisons, pipeline stage/outcome summaries, workload/type/status/category/owner counts and monthly trends. Metadata for page filters is bounded to 1,000 permitted profiles/verticals; report totals are SQL aggregates across all eligible records.

Vertical filtering is restricted to explicit financial attribution/target dimensions. Pipeline uses current owner/currency and expected closing date; workload uses current owner and relevant/scheduled dates. Unassigned contributions are included in all-vertical team actuals; missing targets stay null rather than fabricated zero baselines. Monthly target values remain null. See [reporting definitions](09-reporting-definitions.md) for all metric/date/filter semantics. The report includes the provisional contacts-engaged figures defined in the reporting definitions; it does not calculate lead or follow-up-rate KPIs, infer exchange rates or rebuild historical pipeline stages.


## Cache refresh and timing

Report GET responses remain `private, no-store` at the HTTP boundary; the server may reuse a scoped numeric snapshot for up to 30 seconds. Auth/profile guards run on every request, and permitted profile names are freshly hydrated instead of served from stored snapshots. SQL misses use a captured caller bearer outside cookie-dependent cache execution. The `Server-Timing` report duration measures the authorized handler path (including guards/session/query or hit); it contains no cache key or credentials.

`POST /api/reports/refresh` requires active PSE authentication and a matching Origin, with no JSON body. It expires only the verified user's report and vertical entries, returns `{ refreshed: true }` with private/no-store headers, and returns 401/403/503 on denied/unavailable states or invalidation failure. Caller-supplied identities/tags are not accepted. User/department/role/session/project/filter cache isolation, 30/300-second boundaries and global mutation invalidation are documented in [caching strategy](05-caching-strategy.md). Ordinary mutations retain their existing RLS/uncached validation; this cache never authorizes writes.
