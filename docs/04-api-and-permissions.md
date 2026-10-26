# API and permissions

Database authorization is implemented in grants, row-level security (RLS), validated target approval and triggers. Supabase login/logout, session refresh and server-side request authorization are implemented. Business HTTP handlers remain stubs: they require active PSE access before returning HTTP 501.

## HTTP and session behavior

- `/login` accepts email/password through a Next.js Server Action with server-side validation. Supabase verifies the credentials; shared access logic verifies the user and current profile before granting entry. Failed membership checks attempt to sign out the newly created session. No public signup or profile/role editor is provided.
- `/` redirects to `/dashboard`, `/access-denied` or `/login` according to verified access. The login return path is restricted to workspace routes and cannot redirect to an external site.
- Proxy refreshes/verifies tokens with `getClaims()` and preserves refreshed cookies across redirects. Protected page rendering and all API GET handlers independently verify the current user/profile. Future business services must call the guard before accessing data; layout checks alone are insufficient.
- Anonymous API callers receive JSON 401; authenticated callers without active PSE membership receive 403; identity/profile service failures produce 503 and never grant access. Active PSE callers currently receive 501 from the seven business stubs. Unsupported methods have no implemented mutation.
- `authorizeApi({ manager: true })` provides the server-side manager check for future target mutations. Existing target GET access remains team-wide; target writes still require RLS/approval validation.
- Auth responses use private/no-store headers and Supabase server fetches bypass caching. Cookie-session refresh is implemented; the admin/service-role client remains unused. Sign out affects the current session and reports failure instead of claiming success if the provider rejects it.

## Membership and trusted administration

A CRM caller must have an active `profiles` record in the PSE department. Proposed roles are `pse_member`, `pse_manager` and `admin`; manager permissions do not admit an inactive or non-PSE profile. Authentication alone does not establish PSE membership.

Application clients cannot create profiles or change their own role, department or active flag. A trusted database/Supabase administrator provisions the corresponding Auth identity and profile. No client-accessible signup trigger grants CRM membership, and no demo login credentials are committed.

## Access matrix

| Data or action | Anonymous / non-PSE / inactive | Active PSE member | Active PSE manager/admin |
|---|---|---|---|
| Read permitted CRM records and audit history | Denied | Team-wide read; profiles restricted to PSE | Team-wide read; profiles restricted to PSE |
| Create ordinary contact/opportunity/meeting/activity records | Denied | Own authenticated records under ownership checks | Same checks |
| Edit ordinary operational records | Denied | Own records under creator/owner policies | Manager edits allowed subject to integrity checks |
| Delete ordinary CRM records | Denied | Denied through application grants | Denied through application grants |
| Record a realized contribution | Denied | Authenticated recorder, valid active employee attribution | Same checks |
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
