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
- Contacts-engaged starter metric: distinct linked CRM contact IDs reached through recorded meetings/activities in a selected period, with a documented rule for opportunity-derived contacts and deduplication. Unlinked names remain context and are not treated as unique contact identities. This formula needs PSE confirmation.
- Permission-scoped caching, architecture PDF, Google Drive documentation exports and fictional demo data. Any separate recruiter mandate for caching or submission formats needs email verification.

## Unresolved decisions and external requirements

- Final pipeline stages; target verticals and their relationship to contribution categories, including VBD versus SAC.
- Lead KPI definition; follow-up-rate KPI is unapproved and must not be built.
- Contact active/inactive status; final target management layout and detailed currency/recognition rules.
- Whether every company opportunity must have a secondary contact; the field must remain representable without inventing a mandatory constraint.
- Contacts-engaged eligible interactions, time basis and identity rules, including unlinked participants.
- Odoo export completeness and field mappings, including valuation evidence and optional operational budgets.
- Recruitment email deliverables, platform constraints, caching requirement, deadline/timezone and submission procedure. The original planning assumption is October 28, 2026, 11:59 PM Asia/Dhaka; the Word assessment does not establish it.

## Implementation status

The database foundation is implemented and locally tested: schema constraints, PSE access policies, target reconciliation/locking, audit history, fictional seed and generated types. Supabase login/logout, session refresh and server-side PSE access checks are implemented, with mocked authentication tests and anonymous browser checks. Live-account verification remains with the developer. CRM workflows/forms, reporting and production deployment remain pending. Automated local tests do not establish hosted security or completed CRM workflows. See [system architecture](02-system-architecture.md) for module boundaries, [database schema](03-database-schema.md) for the storage model and [testing and limitations](07-testing-and-limitations.md) for recorded evidence.
