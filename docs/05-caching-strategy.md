# Caching strategy

No application data caching is implemented. Define permission scopes, cache keys, TTLs and mutation invalidation before caching private data.

Contacts/Opportunities reads use caller-scoped, no-store Supabase access and request-rendered pages. Successful deal mutations invalidate the opportunity list/detail/edit paths and the Contacts route tree for linked history. Stage/category changes invalidate Settings and the Opportunities tree. Client forms retain their own entered draft while saving or creating an inline contact; this is transient form state, not a shared private-data cache.

Meetings follows the same request-scoped access model. Internal contact/opportunity suggestions and owner/detail/history reads use no-store requests. The Upcoming boundary uses the server clock for each list request; it is not a cached snapshot. Meeting create/edit/status changes and linked follow-up creation invalidate `/meetings`, the meeting detail/edit paths and the related Contacts, Opportunities and Activities route trees. The linked tasks now open in the implemented Activities workspace.

Meeting forms retain entered values after rejected saves. Their contact/opportunity selections and task text are transient client state, not a shared cache or separate contact snapshot. No cross-user meeting data cache, aggregate reporting cache or completed-follow-up KPI is introduced. Current verification totals remain in the checkpoint test log after final checks.

Caching is a proposed engineering approach. The supplied Word assessment does not specify a caching requirement; verify the original plan's claim of a separate technical requirement against the recruitment email before treating it as mandatory.


Activities uses fresh session/profile checks and caller-scoped no-store reads, including internal meeting/opportunity/contact lookup. No shared aggregate cache is added. Creates, edits, status changes and deletes invalidate `/activities`, its detail/edit paths and Contacts/Opportunities/Meetings layouts so related histories refresh. Status changes preserve relevant timestamps and legacy estimates. Permissions are rechecked by services and RLS rather than trusted from cached UI state. The 20-row list and exact filtered count are operational views, not cached reporting metrics.
