# Requirements and assumptions

## Sources and precedence

Functional source: “Dashboard Requirements for PSE” in `Assessment Material_Associate, Tech 4 Development.pdf`. Pages 1–3 are the original field, pipeline, target and dashboard lists; the “Major requirement changes” section and the meeting clarifications that follow (pages 4–10) override them where they conflict. Earlier fields remain in scope unless superseded.

The recruitment email was not available for the document review. The original plan's deadline, platform mandates and submission package remain unverified against that email. Google Drive URLs for CRM record references are confirmed; Google Drive hosting for documentation is a separate, unverified submission choice.

## Confirmed functional requirements

- Contacts may be individuals or companies; an individual need not have a company. At least email or phone is required, with duplicate checks on both when supplied. Company/workplace is structured and searchable. Notes support referrals, roles, family connections, donor background and engagement history.
- A contact can be created from the New Deal form. Company opportunities retain primary and secondary contact names and email/phone details. The original optional operational budget remains in scope; direct uploads are replaced by Google Drive URLs in notes/description.
- Opportunities require an expected financial value. Forecast and confirmed/realized contributions remain separate; unvalued gifts and general engagement do not count toward monetary achievement.
- For significant in-kind support, the operational team prepares the inventory and market-value estimate. PSE manually enters the agreed value. The CRM does not calculate market valuations, and an expected valuation alone does not establish realized achievement.
- Meetings link to a contact or opportunity and retain scheduled/done status, date/time, contact information and description. Follow-ups are activities.
- Activities include tasks, emails, calls, meetings, events, campaigns, proposals, visits, stewardship, prospect engagement and general work. They retain owner/creator, related person/organization context, status or remaining work, relevant date/time and notes. Contact/opportunity/meeting links are optional, including for independent work.
- PSE members can read colleagues' records; other departments are restricted. Only an explicitly authorized target manager can edit targets.
- Annual targets are allocated unevenly across quarters, then by employee and vertical; percentage-based vertical allocation is preferred. Quarter totals reconcile to the annual total. Targets remain fixed after setup, and Q1 overachievement does not lower Q2 targets.
- Dashboards distinguish monetary fundraising from non-monetary work, including contacts engaged, meeting completion, activity types, stewardship and trends.
- Leads are represented through pipeline stages rather than a separate module. Events can be activity types. Gmail synchronization and external contact/company autofill are excluded.
- Odoo migration requires PSE-supplied source fields, completeness and mapping before import.

## Proposed implementation choices

- Next.js App Router, TypeScript, Supabase Auth/PostgreSQL, Tailwind CSS, daisyUI, Zod and React Hook Form; Vercel hosting and GitHub source control. These are selected choices, not Word-assessment mandates.
- Linked individual contacts for company opportunity primary/secondary contacts; nullable operational budget stored separately from expected value.
- Activity fields for related person/organization text and remaining work, without forcing CRM links or automatically creating contacts.
- Valuation notes and Google Drive references retained with the manually entered agreed value; no valuation engine or direct uploads.
- Opportunity editing by focal person, creator or authorized manager; only managers assign another focal person or configure stages/categories. These extend the database's proposed ownership rules, rather than an explicit assessment restriction on ordinary deal editing.
- A company deal requires a primary individual contact, with a distinct optional secondary contact. Closing date, payment interval, country, description, notes and operational budget remain optional; the assessment lists these fields without establishing every field's requiredness.
- Meetings use the existing required title and owner, plus optional description and a Cancelled status alongside the confirmed Scheduled/Done states. A contact may be a person or organization. For opportunity-only meetings, display the primary contact or party without forcing a duplicate direct contact link. Organization/designation/communication are read from internal contact records. These storage/requiredness choices are documented implementation assumptions.
- Meeting follow-ups are open task activities with the meeting's saved contact/opportunity links. Active PSE colleagues may create their own follow-ups on team meetings; managers may assign another active employee. Activity editing, status changes and all assessment types are now available in the Activities workspace. Meeting times use explicit Asia/Dhaka input/display and UTC storage.
- Contacts engaged (built 28 October 2026 as a provisional figure, migration 0014): distinct CRM contacts reached by Done meetings and Done activities in the period, with interactions that lack their own contact using their meeting's contact, then the deal's primary contact, then the deal's party. Unlinked names are counted as interactions, never as contact identities. The full rule is in [reporting definitions](09-reporting-definitions.md); it is labelled provisional and needs PSE confirmation.
- Permission-scoped caching, architecture PDF, Google Drive documentation exports and fictional demo data. Any separate recruiter mandate for caching or submission formats needs email verification.

## Unresolved decisions and external requirements

Contact deletion is a user-requested project addition, not a requirement stated in the assessment. It permanently removes an unreferenced contact after confirmation, permits the creator or an authorized PSE manager/admin, blocks linked-record deletion through existing foreign keys, and retains audit history. The edit/delete creator-or-manager policy and immutable contact type are implementation choices rather than confirmed JAAGO rules.

Opportunity deletion is also a user-requested addition. It follows existing opportunity edit permissions (focal person, creator or active PSE manager/admin), requires confirmation, preserves contacts/audit history and is blocked by linked meetings, activities or recognized contributions. This policy is a project choice, not an assessment mandate. Closed-stage records without dependent work/actuals can be deleted; a stage is not proof of received funding.

Meeting deletion is a further explicit user addition, matching meeting edit permissions (owner, creator or active PSE manager/admin). Confirmation is required, linked activities/follow-ups block deletion, and parent contacts/opportunities plus audit snapshots remain retained. Migration 0006 adds the matching grant/RLS policy; it does not imply deleting the related work.

- Final pipeline stages; target verticals and their relationship to contribution categories, including VBD versus SAC.
- Lead KPI definition; follow-up-rate KPI is unapproved and must not be built. Pages 2–3 ask for Lead target versus achievement, page 4 says leads are pipeline stages and the KPI still needs confirmation, and the later reporting list (pages 9–10) leaves Lead out. Until PSE defines it, the pipeline count and expected value by stage and outcome is the lead representation; no lead target or lead KPI is shown.
- Meeting, event and monthly targets. Pages 2–3 ask for target versus achievement for Meeting and Events in monthly, quarterly and annual views. Page 6 replaces the target setup with annual → uneven quarterly → member and vertical monetary targets, and pages 9–10 list meeting counts, completion and activity counts rather than count targets. The CRM therefore shows meeting and event counts and monthly actuals, but no meeting, event or monthly targets, and never divides quarters into invented monthly quotas. Count targets need PSE confirmation.
- Team level. Page 9 asks for performance by team member, team and vertical. “Team” is read as the whole PSE team (page 5 makes visibility team-wide; page 9 starts from the annual team target), which is the unfiltered report total. There are no sub-teams in the data model; PSE must say whether sub-team reporting is needed and how members are grouped.
- Whether events need their own module with budgets, participants, sponsor packages, approvals or ROI (pages 5 and 8). Until then an event is an Activity type.
- Contact active/inactive status; final target management layout, who besides Safina may manage targets (pages 5 and 9), and detailed currency/recognition rules.
- Whether every company opportunity must have a secondary contact; the field must remain representable without inventing a mandatory constraint.
- Contacts-engaged eligible interactions, time basis and identity rules, including unlinked participants. A provisional version is built and labelled as such; PSE may confirm or replace it.
- Odoo export completeness and field mappings, including valuation evidence and optional operational budgets.
- Recruitment email deliverables, platform constraints, caching requirement, deadline/timezone and submission procedure. The original planning assumption is October 28, 2026, 11:59 PM Asia/Dhaka; the Word assessment does not establish it.

## Meetings assessment check

The supplied Word assessment was reread for this checkpoint. The original Meetings field list and later “Meetings and events,” visibility, internal-lookup and follow-up clarifications support the implemented workflow:

| Document requirement | Implemented behavior |
|---|---|
| Organization, point of contact, optional designation and email/phone | Internal contact records provide names, workplace, designation and communication details; a company opportunity can derive its primary contact |
| Meeting date/time, Scheduled/Done and description | Editable event time and description, explicit statuses, UTC storage and Asia/Dhaka input/display |
| A meeting can link to a contact or opportunity | Contact-only, opportunity-only and compatible combined links are supported; neither link is forced when the other exists |
| Follow-up belongs in Activities | Meeting details create an open task activity with authoritative inherited links |
| PSE-wide visibility with other departments restricted | Verified active PSE access, caller-scoped queries and existing RLS |
| Internal suggestions permitted; external autofill/Gmail excluded | Existing contacts/deals only; no external enrichment or synchronization |
| Meetings do not automatically establish monetary achievement | Completion, follow-up creation, deletion and demonstration seeding create no recognized contributions |

Required title/owner, optional description requiredness, Cancelled status, detailed edit/delete permissions and live-linked contact details rather than immutable contact snapshots are implementation choices. A company contact can be selected directly; whether every company-only meeting must instead require a named individual remains a PSE clarification. Named individuals and opportunity primary contacts are already supported. Deletion is explicitly requested by the user, not mandated in the assessment. Activities editing is now available; dashboard meeting counts/status are implemented; the broader submission deliverables remain pending; no follow-up-rate KPI is inferred.

## Implementation status

The database foundation, authentication, Contacts, financial Opportunities, Meetings and Activities workflows are implemented, including confirmed deletion for unlinked records. Meetings retain linked follow-up task creation and protected history. All 618 local tests and nineteen anonymous browser checks pass. The configured project has all eleven migrations applied and fictional demo contacts/deals plus six meetings (three Scheduled, two Done, one Cancelled) and 11 activities; existing rows are preserved. The explicitly requested finance seed adds fictional actuals and target plans as documented below. Hosted sign-in and interactive end-user browser workflows remain manual. Recognized contribution entry and target allocation/approval/performance are implemented. The dashboard and detailed reports are implemented. Permission-scoped caching is implemented. Signed-in/multi-instance acceptance, deployment and real Odoo import remain pending. See [system architecture](02-system-architecture.md), [database schema](03-database-schema.md) and [testing and limitations](07-testing-and-limitations.md).


## Activities assessment check

The Activities field list and later activity/meeting/event, small-gift, independent-work and visibility clarifications in the supplied Word assessment were checked for this checkpoint.

| Document requirement | Implemented behavior |
|---|---|
| Task, email, call, meeting, event, campaign, proposal preparation/submission, school/office visit, donor servicing/stewardship, potential-donor engagement, general work | All 11 types selectable, searchable and filterable |
| Owner/creator, person/organization context, status or remaining work, relevant date/time and notes | Verified creator, selected owner, free person/organization text, status, remaining-work and long notes; optional relevant timestamp |
| Independent work; optional contact/deal/meeting relationships | All three links can be empty. Context does not automatically create contacts or a financial deal |
| Follow-ups are Activities | Existing meeting tasks appear in the same workspace, with edit/status/delete and navigation from meeting details |
| Small/unvalued gifts and nonfinancial engagement separate from actual fundraising | Descriptive work logs only; completion does not create or change contributions, targets or forecast values |
| Internal information lookup; Drive references; no Gmail sync or external autofill | Authenticated internal selectors, HTTP(S) references and long notes; manually logged email; no uploads or external enrichment |
| Team visibility; restricted other departments | Fresh active-PSE server checks plus caller-scoped SQL RLS |

Proposed project choices: work-category keys `stewardship`, `prospect_engagement`, `independent_general`; statuses Open/In progress/Done/Cancelled; required nonblank notes (up to 10,000 characters), optional time, Asia/Dhaka display and UTC persistence; 20-row pages; owner/creator/manager editing and deletion, with manager-only reassignment. These exact enums, limits and permissions are not claimed as assessment mandates.

Activity deletion is explicitly requested by the user. Migration 0007 adds its grant/RLS policy; confirmation names the entry, parents remain intact and immutable audit snapshots remain. No soft-delete or automatic parent deletion is introduced. The proposed legacy `estimated_nonmonetary_value` field remains stored but is not exposed or overwritten by the workflow; no currency or valuation rule is invented for it.

A Meeting-type activity is a work log, not a second scheduled meeting. Events use Activities without registration, budget or ROI workflows. No lead KPI, follow-up-rate KPI or reporting totals are invented; contacts engaged later received a provisional, labelled definition (see below). The Phase 11 operational reports now cover confirmed financial/workload counts and trends; unapproved KPIs remain excluded. Supplied demo records are fictional and clearly labeled.


## Phase 10 assessment check

| Confirmed requirement | Implementation |
|---|---|
| Annual target, manually uneven quarters, allocations by employee and vertical, preferably percentages | Manager draft form, four quarter baselines, then per quarter each member's amount split across verticals by percentage (decided 28 October 2026); the resulting employee/vertical cells are stored |
| Quarterly targets total the annual target and stay fixed after setup | Decimal reconciliation in approval transaction; approved headers/quarters/cells are immutable |
| Primarily Safina or another explicitly authorized manager edits targets; PSE team can view | Trusted active PSE manager/admin roles control configuration, saves and approval; other active PSE staff have read access |
| Forecast differs from confirmed/realized achievement | Separate append-only contribution records entered from opportunities; no expected-value copy or automatic Won recognition |
| Operational team supplies significant in-kind estimate; PSE enters agreed value | Manually entered amount plus required valuation/source note and optional inventory/estimate URL; no valuation engine |
| Q1 110% remains Q1 110%; Q2 assigned target stays unchanged | Quarter actuals and attainment calculated separately from stored fixed baselines; no carry-forward adjustment |
| Team/member/vertical and quarterly/annual performance | Target detail includes annual, quarter and employee/vertical actual-versus-target views |

Project choices: separate contribution forms/list/details, append-only receipts with no refund/correction/delete workflow, two-step receipt review, stable submission IDs for safe retries, draft-save and approval steps, transactional replacement of draft allocation cells, stale-version conflict detection, and server-fixed recorder identity. Decided 28 October 2026: a member records support credited to themselves and an authorized manager may credit any active employee, and new receipts are accepted only on open or won deals (receipts recorded before a deal closed stay valid). Before that decision, any active PSE member could attribute support to any active employee. Both rules are project choices enforced in the service and the database (migrations 0012 and 0013), not assessment mandates. Target managers are provisioned trusted roles; the final hierarchy remains unresolved.

Money input uses at most 12 whole digits and two decimals. Percentages use at most two decimals and split a member's quarter amount across verticals; they must total 100% per member. Each part rounds down to the cent and the member's last vertical takes the leftover cents, so a member's cells always equal their amount. Canonical stored values are monetary amounts, not a second editable percentage ledger. Drafts may be incomplete; approval requires every total to reconcile and all dimensions to be active. The supported form year range is 1–9998.

Reporting uses the contribution recognition instant interpreted in Asia/Dhaka to select calendar year/quarter. Currency and financial type must match the linked opportunity; currencies are never converted or combined. Attribution is explicit and remains unchanged when an opportunity changes owners. Vertical is optional for receipts, and unassigned/out-of-allocation actuals remain included in team performance. Contribution categories and target verticals remain independent; no DSP/VBD/SAC equivalence or finalized hierarchy is invented. General dashboard/reporting remains Phase 11.


## Fictional finance examples

The requested hosted finance seed creates six labeled fictional receipts, three explicitly provisional demo verticals and two draft BDT plans. It demonstrates 2026 Q1 at 110%, unchanged Q2, separate USD support, manual in-kind evidence and unassigned attribution. Both plans remain unapproved; administrative fixture creation does not impersonate an end-user or grant approval authority. A service-role-only helper atomically inserts a reserved demo plan plus its children and skips any existing plan entirely. No final vertical/category mapping is inferred, and no existing opportunity forecast/stage, contact, meeting, activity, user or role is modified.


## Phase 11 assessment check

| Confirmed direction | Implementation |
|---|---|
| Separate monetary fundraising and non-monetary work lenses | Distinct dashboard/report sections; activity estimates and work counts never become monetary achievement |
| Actual-versus-target, remaining, overachievement, employee/team/vertical performance | Stored annual/quarter baselines or explicit allocation cells compared with recognized contributions; missing targets stay unavailable; draft targets are provisional |
| Pipeline counts/value by stage and open/won/lost/abandoned/junk | Current configured stages/outcomes for opportunities expected to close in the selected period; expected values stay separate from receipts |
| Cash and valued in-kind | Actual contributions grouped by the saved financial type, in a single selected currency |
| Meetings, activity types, stewardship, prospect/general work, employee workload and trends | Separate current-status record counts and monthly activity/meeting/recognition trends |
| Team-wide PSE visibility; restricted other departments | Fresh server identity checks and an invoker SQL aggregate with current PSE membership plus existing RLS |
| Related person/organization context for Activities | A nonblank person/organization or CRM link is required on create/update; existing context-free rows remain readable for correction |

Reporting-period/date rules, draft target labels, currency isolation and the lack of monthly target baselines are documented implementation choices. Financial dates use recognition time; meetings use scheduled time; activities use relevant time. Pipeline date filtering uses expected closing dates and current stage, not historical stage reconstruction. Undated work/deals are counted separately across the selected owner, without inventing relevant dates. Related context through a valid CRM link is accepted without forcing duplicate free-text names.

Funding vertical filters apply only where an explicit vertical exists (targets/contributions). No contribution-category-to-vertical mapping or workload vertical is inferred. Employee selects historical contribution attribution for actuals and current ownership for pipeline/work. Monthly views display actuals only because monthly target allocation is not defined. Lead and follow-up-rate KPIs remain absent pending PSE definitions; contacts engaged is shown with a provisional definition. Full [metric definitions](09-reporting-definitions.md) distinguish record counts from unique interactions and explain filter scopes. The legacy Activity constraint is NOT VALID for historical rows, but enforces all new/updated rows without backfill.


## Phase 12 technical choices

Caching is user-authorized engineering work, not a mandate established by the Word assessment. The implemented choice is a maximum 30-second report snapshot and 300-second vertical lookup, partitioned by project, verified user, role/department, hashed session and normalized filters. Authentication and permitted profile names remain fresh. Cached profile display names are removed and rehydrated through current caller-scoped lookup. Transactional forms/details and financial/approval validation are uncached. App writes and the authenticated Refresh endpoint expire applicable tags immediately; direct administrative writes need Refresh or TTL expiry.

The local 10,002-receipt benchmark reports the shared SQL/service/cache-policy path, using an isolated test store rather than a deployed cache backend. It demonstrates reduced repeated query work without asserting a hosted speedup. Server-Timing supports later authorized HTTP measurements. Multi-instance cache propagation and live signed-in acceptance remain deployment checks; caching can be disabled until those checks are complete. KPI definitions, targets, currencies, valuations and source-data permissions are unchanged.
