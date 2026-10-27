# Caching strategy

Phase 12 adds short-lived, authenticated **per-user/session** report snapshots and stable report vertical metadata. Authentication, profile permissions/names and transactional detail/form reads remain uncached. HTTP responses stay `private, no-store`; only the internal server Data Cache reuses eligible values.

Caching is a selected engineering approach. The supplied Word assessment does not mandate it; any separate recruitment-email requirement still needs verification.

## Cache entries and keys

| Entry | Maximum reuse | Contents |
|---|---|---|
| Report snapshot | 30 seconds | SQL-derived numeric/grouped report data, with profile display names removed before storage |
| Report funding-vertical lookup | 300 seconds | Permitted vertical IDs/names/active/provisional flags |
| Current user, department, role and active status | Never cached across requests | Fresh verified Supabase user and current profile before cache lookup |
| Report profile names/options | Never cached across requests | Fresh caller-scoped PSE lookup, memoized only within the current service/request |
| Contact/deal/meeting/activity/target/contribution transactional reads | No new caching | Existing no-store caller-scoped access |

Keys contain cache version, resource, hashed project origin, verified user ID, role/department, a SHA-256 fingerprint of the current session bearer, normalized filters and a time bucket. Report identity includes year, period, employee, vertical and currency. Vertical keys have their own bucket. Tokens, passwords, service keys and cookies are never key text or cache values. Token refresh changes the fingerprint and causes a cold entry. No cache is shared between users, roles, sessions or projects.

Bucketed keys impose a hard age boundary: an expired bucket is not reused while background revalidation runs. The underlying Next `unstable_cache` entry also has a matching TTL. The application keeps Cache Components disabled and uses this supported legacy Data Cache API to preserve the existing request-rendered authentication/layout model. Request cookies/session capture happen outside the cached callback. Misses use a cookie-free Supabase client with the captured caller bearer and publishable key, so SQL still runs under caller RLS. No administrative client is used by reports.

## Authorization and profile privacy

Fresh `getUser()` verification and a current active-PSE profile check precede every production cache lookup. The captured session identity must match that verified user. Anonymous, inactive, non-PSE, mismatched or unavailable identity states cannot receive a warm snapshot. A fresh profile lookup also fails closed if PSE profile visibility disappears.

Report employee/owner names are redacted before storage, then hydrated from the fresh permitted profile list on every request, including hits. A profile that moves outside the permitted department is no longer named from an old cached snapshot. Numeric aggregates remain scoped to the application's current rule that all active PSE members can read team operational records. If record-level permission rules change, disable caching or change its scope/version and validate those rules before rollout. Profile option/name lookup is capped at 1,000; missing/historical identities receive a generic label. Aggregate amounts/counts are not capped.

## Invalidation and Refresh

| Successful write | Cache action |
|---|---|
| Opportunity create/edit/delete/stage changes | Expire all project report snapshots |
| Stage/category configuration | Expire all project report snapshots |
| Meetings, statuses and follow-up creation | Expire all project report snapshots |
| Activities create/edit/status/delete | Expire all project report snapshots |
| Receipts, target drafts/approval and vertical configuration | Expire all project reports and vertical metadata |
| Refresh data | Expire the verified user's report/vertical entries across their filters/sessions |

Route handlers use `revalidateTag(tag, { expire: 0 })`: the next read blocks for fresh data instead of serving stale-while-revalidate results. Existing route-path invalidations remain for UI navigation. `POST /api/reports/refresh` requires a fresh active-PSE session and matching Origin; callers cannot supply another user's cache identity. The button waits for invalidation to succeed before refreshing the current view and shows errors otherwise.

The displayed generation timestamp belongs to the numeric snapshot. Auth and profile labels are refreshed separately on every request. Direct Supabase edits, imports and seed scripts bypass app tag invalidation: use Refresh data or wait up to 30 seconds for report values (300 seconds for vertical options). Ordinary browser reloads may reuse an unexpired server entry. A provider/cache failure on a required reload is reported; expired snapshots are not an error fallback. Financial writes and approval always validate current uncached data, never cached report totals.

## Deployment controls

`PSE_REPORT_CACHE_ENABLED=false` bypasses both report and vertical caching; restart the app after changing the server-only setting. It defaults to enabled for the current single-instance development setup. Authentication and transactional reads are unchanged in either mode. Keys/tags are project scoped.

Next Data Cache persistence and tag propagation depend on the deployment cache handler. Cross-instance invalidation, invalidation during concurrent cache fills and hosted signed-in acceptance have not been verified. Keep the flag false for self-hosted replicas until a shared handler and cross-session read-after-write behavior are verified. No Redis/service-role cache or deployment was provisioned in this checkpoint.

## Reproducible local measurement

Run `npm.cmd run benchmark:reports`. The command needs no environment variables, network, Docker or hosted credentials. It creates an isolated PGlite database, adds 10,000 fictional receipts, and measures the shared report service/read/options path with fresh local profile authorization and profile-name lookup on every request. The server-only marker is resolved with Node's `react-server` condition for this isolated CLI.

The measured full-year BDT report included **10,002 receipts**:

| Local path | Samples | Median | p95 |
|---|---|---|---|
| Uncached | 25 | 46.333 ms | 54.672 ms |
| Warm cache policy | 25 | 5.316 ms | 7.097 ms |

One cold cached request took 48.340 ms. Twenty-five uncached requests issued 25 report queries and 25 vertical lookups. One cold plus 25 warm cached requests issued one report query and one vertical lookup, while authorization/profile checks still ran for all 26 requests. Assertions confirm identical financial/pipeline values, a new receipt after invalidation, and denied access after profile deactivation despite a warm cache.

Raw evidence: [report-cache.json](benchmarks/report-cache.json). Storage in this experiment is the isolated `MeasurementCache` driver, **not production Next Data Cache persistence**. The measurements exclude Supabase JWT/network verification, HTTP/RSC rendering, browser time and distributed storage. They demonstrate the local SQL/cache-policy effect, not a hosted page-speed improvement. Authorized report API responses expose `Server-Timing: report;dur=...` for later real HTTP measurement; no credential or cache-scope values are emitted.
