# Migration plan

Proposed Odoo workflow: obtain authorized exports, map fields, normalize, review duplicates, dry-run import, validate counts and totals, and prepare rollback. No real data has been migrated. Since 28 October 2026 the app can import files whose check finds nothing to review (below); real exports still wait for PSE's field mapping.

The later assessment clarifications include migration, but PSE must provide the source fields, completeness and old-to-new mappings before import. Do not infer missing source data.

The proposed mapping review must preserve company primary/secondary contact details, optional operational budgets, activity person/organization context and remaining work, and operational-team valuation evidence with manually entered agreed values. Keep budgets and forecasts separate from realized contributions. Missing valuation evidence or contact identities require review; do not manufacture them or merge unlinked people based only on matching names.

## Dry run (awaiting PSE field mapping)

The import check runs in two places, with the same rules (`src/features/odoo`). Neither imports or writes anything:

- **In the app:** Settings → Odoo import check (`/settings/odoo-import`), for PSE managers. It uploads up to three CSV files of 2 MB each to `POST /api/settings/odoo-check`, which checks them in memory and returns the report; files are never stored. The comparison data is read with the signed-in manager's own Supabase client, so RLS applies and no service-role key is used. **Check the sample files** runs it on the fictional templates.
- **On the command line:** `npm.cmd run odoo:dry-run` prints the report for files of any size. Without options it reads the fictional templates; pass `-- --contacts <csv> --deals <csv> --activities <csv>` for other files, and `-- --offline` to skip the project lookups. Its lookups use the server-only service role key, as below.

There are two fictional sample sets in `public/odoo-templates/`, both downloadable from the Settings page:

- `mixed/`: a problem of every kind (a duplicate email, a contact without email or phone, an unknown salesperson, stage and tag, a zero amount, impossible dates, a missing contact person, links to rows that are not in the files). Nothing can be imported from it.
- `ready/`: two companies with their contact people, an individual donor, four deals spread across the five named demo staff, and five activities. It passes against the hosted demo and can be imported once.

### Import

When a check finds nothing to review, the page offers **Import N contacts, N deals, N activities**. The server checks the same files again and refuses if anything now needs review. It then builds the rows (new IDs, companies linked to their people, deals to their party and contact person, activities to their deal, and staff, stages and categories resolved by name) and calls `import_odoo`, which inserts them all in one transaction with the manager's own rights. If any row is refused, nothing is imported. A contact's second number (`mobile`, when `phone` is also set) is kept in its notes, because the CRM stores one phone.

Every imported record keeps its Odoo ID, unique per table. A second check of the same files reports each row as already imported, and the database refuses a repeat even if the check is bypassed. Imported records are ordinary CRM records: they can be edited and deleted as usual. The column names below are a proposal based on Odoo's `res.partner`, `crm.lead` and `mail.activity` exports. PSE has to confirm them before the tool is used on real exports.

| File | Columns | CRM record |
| --- | --- | --- |
| Contacts | `odoo_id`, `is_company`, `name`, `parent_odoo_id`, `function`, `email`, `phone`, `mobile`, `website`, `industry`, `comment` | Contact: `is_company` gives the kind, `parent_odoo_id` the company link, `function` the designation, `phone` (or `mobile`) the phone, `comment` the notes |
| Deals | `odoo_id`, `name`, `partner_odoo_id`, `contact_odoo_id`, `salesperson`, `stage`, `tag`, `contribution_type`, `expected_revenue`, `currency`, `date_deadline`, `country`, `description`, `valuation_note` | Opportunity: party, primary contact person, focal person, stage, contribution category, financial type, expected value and expected closing date |
| Activities | `odoo_id`, `activity_type`, `work_category`, `status`, `date`, `assigned_to`, `partner_odoo_id`, `deal_odoo_id`, `related_person`, `related_organization`, `summary`, `note`, `remaining_work` | Activity: `summary` and `note` together become the notes |

What the dry run checks:

1. **The CRM's own create rules.** Every row is validated with the same Zod schemas the forms and API use (`contactSchema`, `opportunitySchema`, `activitySchema`). Links that an import would create are filled with placeholder IDs, so the schemas check every other field. Messages name the template column to fix.
2. **Links by Odoo ID, never by name.** Deals and activities refer to contacts and deals by `odoo_id`. A missing or repeated `odoo_id`, a link to a row that is not in the file, a company deal without its individual contact person, a contact person who is a company, and an activity naming someone who is not its deal's party or contact person are all reported.
3. **Duplicates by email or phone.** Emails and phone numbers are normalized with the contact module's `normalizeEmail` and `normalizePhone`. They are compared within the file and, read-only, with the project's existing contacts. Matches are reported for review and never merged; matching names alone are not treated as duplicates.
4. **Already imported.** An Odoo ID that is already in the CRM is reported, so a second import of the same file is refused.
5. **Configured names.** `salesperson` and `assigned_to` must match exactly one active PSE profile by display name. `stage` must match an active pipeline stage, and `tag` an active contribution category by code or name. Two profiles with the same name are reported as ambiguous. These checks are skipped with `--offline`.
6. **Value mappings.** Odoo's activity type "To Do" (and "Upload Document") maps to Task, and the states planned, today and overdue map to Open. Other values must already be CRM codes. Dates are `YYYY-MM-DD` or `YYYY-MM-DD HH:MM` and are read as Asia/Dhaka time.

On the command line the project lookups use the server-only service role key from `.env.local` through `scripts/lib/hosted-demo.ts`, and only select rows (`src/features/odoo/reference.ts`); `-- --sample ready` checks the ready set. The command line never imports.

Open mapping questions for PSE (also in [docs/01](01-requirements-and-assumptions.md)):

- Which Odoo fields hold the CRM's contribution type, contribution category and valuation evidence? Odoo has no direct equivalent of cash versus valued in-kind.
- The timezone of exported dates, and whether completed activities come from `mail.activity` or the chatter history.
- How Odoo salespeople map to PSE profiles, and which Odoo stages map to which CRM stages.
- Whether a contact's second number (`mobile`) should be kept, since the CRM stores one phone per contact.
