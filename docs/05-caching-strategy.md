# Caching strategy

No application data caching is implemented. Define permission scopes, cache keys, TTLs and mutation invalidation before caching private data.

Contacts/Opportunities reads use caller-scoped, no-store Supabase access and request-rendered pages. Successful deal mutations invalidate the opportunity list/detail/edit paths and the Contacts route tree for linked history. Stage/category changes invalidate Settings and the Opportunities tree. Client forms retain their own entered draft while saving or creating an inline contact; this is transient form state, not a shared private-data cache.

Caching is a proposed engineering approach. The supplied Word assessment does not specify a caching requirement; verify the original plan's claim of a separate technical requirement against the recruitment email before treating it as mandatory.
