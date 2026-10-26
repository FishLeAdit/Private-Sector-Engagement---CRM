# Requirements and assumptions

## Sources and precedence

Functional source: “Dashboard Requirements for PSE” in `Assessment Material_Associate, Tech 4 Development.docx`. The “Major requirement changes” section and later meeting clarifications override conflicting earlier field specifications. Earlier fields remain in scope unless superseded.

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
- Contacts-engaged starter metric: distinct linked CRM contact IDs reached through recorded meetings/activities in a selected period, with a documented rule for opportunity-derived contacts and deduplication. Unlinked names remain context and are not treated as unique contact identities. This formula needs PSE confirmation.
- Permission-scoped caching, architecture PDF, Google Drive documentation exports and fictional demo data. Any separate recruiter mandate for caching or submission formats needs email verification.

## Unresolved decisions and external requirements

Contact deletion is a user-requested project addition, not a requirement stated in the assessment. It permanently removes an unreferenced contact after confirmation, permits the creator or an authorized PSE manager/admin, blocks linked-record deletion through existing foreign keys, and retains audit history. The edit/delete creator-or-manager policy and immutable contact type are implementation choices rather than confirmed JAAGO rules.

Opportunity deletion is also a user-requested addition. It follows existing opportunity edit permissions (focal person, creator or active PSE manager/admin), requires confirmation, preserves contacts/audit history and is blocked by linked meetings, activities or recognized contributions. This policy is a project choice, not an assessment mandate. Closed-stage records without dependent work/actuals can be deleted; a stage is not proof of received funding.

Meeting deletion is a further explicit user addition, matching meeting edit permissions (owner, creator or active PSE manager/admin). Confirmation is required, linked activities/follow-ups block deletion, and parent contacts/opportunities plus audit snapshots remain retained. Migration 0006 adds the matching grant/RLS policy; it does not imply deleting the related work.

- Final pipeline stages; target verticals and their relationship to contribution categories, including VBD versus SAC.
- Lead KPI definition; follow-up-rate KPI is unapproved and must not be built.
- Contact active/inactive status; final target management layout and detailed currency/recognition rules.
- Whether every company opportunity must have a secondary contact; the field must remain representable without inventing a mandatory constraint.
- Contacts-engaged eligible interactions, time basis and identity rules, including unlinked participants.
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

Required title/owner, optional description requiredness, Cancelled status, detailed edit/delete permissions and live-linked contact details rather than immutable contact snapshots are implementation choices. A company contact can be selected directly; whether every company-only meeting must instead require a named individual remains a PSE clarification. Named individuals and opportunity primary contacts are already supported. Deletion is explicitly requested by the user, not mandated in the assessment. Activities editing is now available; dashboard meeting metrics and the broader assessment deliverables remain pending; no follow-up-rate KPI is inferred.

## Implementation status

The database foundation, authentication, Contacts, financial Opportunities, Meetings and Activities workflows are implemented, including confirmed deletion for unlinked records. Meetings retain linked follow-up task creation and protected history. All 418 local tests and twelve anonymous browser checks pass. The configured project has all seven migrations applied and fictional demo contacts/deals plus six meetings (three Scheduled, two Done, one Cancelled) and 11 activities; existing rows and monetary achievement are preserved. Hosted sign-in and interactive end-user browser workflows remain manual. Target/contribution-entry UI, reporting and deployment remain pending. See [system architecture](02-system-architecture.md), [database schema](03-database-schema.md) and [testing and limitations](07-testing-and-limitations.md).


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

A Meeting-type activity is a work log, not a second scheduled meeting. Events use Activities without registration, budget or ROI workflows. No contacts-engaged deduplication formula, lead KPI, follow-up-rate KPI or reporting totals are invented. Full reporting remains a later checkpoint. Supplied demo records are fictional and clearly labeled.
