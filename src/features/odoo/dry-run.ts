// Odoo import check. Validates exported contacts, deals and activities against the CRM's own create rules and
// reports what needs review before anything could be imported. It never writes; import-plan.ts turns a clean
// check into the rows to insert.
import type { z } from "zod";
import {
  activitySchema,
  activityStatuses,
  activityTypes,
  workCategories,
  type ActivityInput,
} from "@/features/activities/schemas";
import { contactSchema, normalizeEmail, normalizePhone, type ContactInput } from "@/features/contacts/schemas";
import { opportunitySchema, type OpportunityInput } from "@/features/opportunities/schemas";
import { fromDhakaDateTimeInput } from "@/lib/dates";
import { columns, pending, sourceColumn, statusAliases, typeAliases, type FileKey } from "./columns";
import type { CsvRecord, CsvTable } from "./csv";
import type { DryRunReport, FileSummary, Finding, Reference } from "./types";

const key = (value: string) => value.trim().toLowerCase();
type Ref = { id: string };
// Each row's parsed values and resolved links, kept so a clean check can be imported.
export type CheckedRows = {
  contacts: { row: CsvRecord; data: ContactInput; parent: string }[];
  deals: { row: CsvRecord; data: OpportunityInput; owner?: Ref; stage?: Ref; category?: Ref }[];
  activities: { row: CsvRecord; data: ActivityInput; owner?: Ref }[];
};

export function dryRun(tables: Record<FileKey, CsvTable>, reference: Reference | null): DryRunReport {
  return checkTables(tables, reference).report;
}

export function checkTables(tables: Record<FileKey, CsvTable>, reference: Reference | null) {
  const findings: Finding[] = [];
  const checked: CheckedRows = { contacts: [], deals: [], activities: [] };
  const files = {} as Record<FileKey, FileSummary>;
  const usable = {} as Record<FileKey, CsvRecord[]>;
  for (const file of Object.keys(columns) as FileKey[]) {
    const { headers, rows } = tables[file];
    const missing = columns[file].filter(name => !headers.includes(name));
    files[file] = {
      rows: rows.length,
      ready: 0,
      missing,
      ignored: headers.filter(name => !(columns[file] as readonly string[]).includes(name)),
    };
    // A file without its columns cannot be checked row by row.
    usable[file] = missing.length ? [] : rows;
  }
  const flag = (file: FileKey, row: CsvRecord, message: string) =>
    findings.push({ file, line: row.line, odooId: row.values.odoo_id ?? "", message });
  function parsed<T>(file: FileKey, row: CsvRecord, result: z.ZodSafeParseResult<T>) {
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      const field = String(issue.path[0] ?? "");
      flag(file, row, `${sourceColumn[field] ?? (field || "row")}: ${issue.message}`);
    }
    return null;
  }
  const byId = (file: FileKey) => {
    const ids = new Map<string, CsvRecord>();
    for (const row of usable[file]) {
      const id = row.values.odoo_id;
      if (row.extra) flag(file, row, `has ${row.extra} more value(s) than there are columns; check the quoting.`);
      if (!id) flag(file, row, "odoo_id: required, so other files can refer to this row.");
      else if (ids.has(id)) flag(file, row, `odoo_id: also used on line ${ids.get(id)!.line}.`);
      else ids.set(id, row);
      if (id && reference?.imported[file].includes(id))
        flag(file, row, "odoo_id: already imported into the CRM; importing it again would duplicate it.");
    }
    return ids;
  };
  const contacts = byId("contacts"),
    deals = byId("deals");
  byId("activities");
  const isCompany = (row: CsvRecord) => ["true", "1", "yes"].includes(key(row.values.is_company));

  // The staff, stage and category names an export uses must each match exactly one configured record.
  function match<T extends { id: string; active: boolean }>(
    file: FileKey,
    row: CsvRecord,
    rows: T[] | undefined,
    value: string,
    names: (row: T) => string[],
    column: string,
    what: string,
  ) {
    if (!value) return void flag(file, row, `${column}: required.`);
    if (!rows) return; // offline: not checked
    const found = rows.filter(r => r.active && names(r).some(name => key(name) === key(value)));
    if (found.length === 1) return found[0];
    flag(
      file,
      row,
      found.length
        ? `${column}: "${value}" matches ${found.length} ${what}s; make the names distinct.`
        : `${column}: "${value}" is not an active ${what}; map it to one before import.`,
    );
  }
  const owner = (file: FileKey, row: CsvRecord, value: string, column: string) =>
    match(file, row, reference?.owners, value, o => [o.display_name], column, "PSE profile");

  // Contacts: the create rules, the company link, and duplicates by email or phone (never by name alone).
  const seen = new Map<string, CsvRecord>();
  for (const row of usable.contacts) {
    const v = row.values;
    if (!["true", "false", "1", "0", "yes", "no"].includes(key(v.is_company)))
      flag("contacts", row, "is_company: use TRUE or FALSE.");
    const data = parsed(
      "contacts",
      row,
      contactSchema.safeParse({
        kind: isCompany(row) ? "company" : "individual",
        name: v.name,
        email: v.email,
        phone: v.phone || v.mobile,
        company_id: v.parent_odoo_id ? pending(1) : "",
        designation: v.function,
        website: v.website,
        industry: v.industry,
        notes: v.comment,
      }),
    );
    if (data) checked.contacts.push({ row, data, parent: v.parent_odoo_id });
    const parent = v.parent_odoo_id && contacts.get(v.parent_odoo_id);
    if (v.parent_odoo_id && (!parent || !isCompany(parent)))
      flag("contacts", row, `parent_odoo_id: "${v.parent_odoo_id}" is not a company in the contacts file.`);
    const methods: [string, string | null][] = [
      ["email", normalizeEmail(v.email)],
      ["phone", normalizePhone(v.phone)],
      ["phone", normalizePhone(v.mobile)],
    ];
    for (const [method, value] of methods) {
      if (!value) continue;
      const earlier = seen.get(`${method}:${value}`);
      if (earlier && earlier !== row)
        flag(
          "contacts",
          row,
          `${method}: same as line ${earlier.line} (${earlier.values.odoo_id}); review before merging.`,
        );
      else seen.set(`${method}:${value}`, row);
      const existing = reference?.contacts.find(c =>
        method === "email" ? c.email_normalized === value : c.phone_normalized === value,
      );
      if (existing) flag("contacts", row, `${method}: matches the existing CRM contact "${existing.name}".`);
    }
  }

  // Deals: the create rules with placeholder links, then each link and configured name.
  for (const row of usable.deals) {
    const v = row.values;
    const party = contacts.get(v.partner_odoo_id),
      person = v.contact_odoo_id ? contacts.get(v.contact_odoo_id) : undefined;
    const data = parsed(
      "deals",
      row,
      opportunitySchema.safeParse({
        deal_name: v.name,
        contact_id: pending(1),
        primary_contact_id: v.contact_odoo_id ? pending(2) : "",
        owner_id: pending(3),
        stage_id: pending(4),
        contribution_category_id: pending(5),
        contribution_type: v.contribution_type,
        expected_amount: v.expected_revenue,
        currency: v.currency || "BDT",
        expected_close_at: v.date_deadline,
        country: v.country,
        description: v.description,
        valuation_note: v.valuation_note,
      }),
    );
    if (!party) flag("deals", row, `partner_odoo_id: "${v.partner_odoo_id}" is not in the contacts file.`);
    if (v.contact_odoo_id && (!person || isCompany(person)))
      flag("deals", row, `contact_odoo_id: "${v.contact_odoo_id}" is not an individual in the contacts file.`);
    if (party && isCompany(party) && !v.contact_odoo_id)
      flag("deals", row, "contact_odoo_id: a company deal needs its individual contact person.");
    if (party && !isCompany(party) && v.contact_odoo_id && v.contact_odoo_id !== v.partner_odoo_id)
      flag("deals", row, "contact_odoo_id: an individual deal uses that individual as its contact person.");
    const resolved = {
      owner: owner("deals", row, v.salesperson, "salesperson"),
      stage: match("deals", row, reference?.stages, v.stage, s => [s.name], "stage", "pipeline stage"),
      category: match(
        "deals",
        row,
        reference?.categories,
        v.tag,
        c => [c.code, c.name],
        "tag",
        "contribution category",
      ),
    };
    if (data) checked.deals.push({ row, data, ...resolved });
  }

  // Activities: Odoo's type and state names, the date as Asia/Dhaka time, the owner and the links.
  for (const row of usable.activities) {
    const v = row.values;
    const type = typeAliases[key(v.activity_type)] ?? key(v.activity_type).replace(/\s+/g, "_");
    const status = statusAliases[key(v.status)] ?? (key(v.status).replace(/\s+/g, "_") || "open");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? `${v.date}T00:00` : v.date.replace(" ", "T").slice(0, 16);
    const occurred = v.date ? fromDhakaDateTimeInput(date) : "";
    if (v.date && !occurred) flag("activities", row, `date: "${v.date}" is not a YYYY-MM-DD [HH:MM] date.`);
    if (!(activityTypes as readonly string[]).includes(type))
      flag("activities", row, `activity_type: "${v.activity_type}" has no CRM activity type mapped.`);
    if (!(activityStatuses as readonly string[]).includes(status))
      flag("activities", row, `status: "${v.status}" has no CRM status mapped.`);
    if (v.work_category && !(workCategories as readonly string[]).includes(key(v.work_category)))
      flag("activities", row, `work_category: use one of ${workCategories.join(", ")}.`);
    const data = parsed(
      "activities",
      row,
      activitySchema.safeParse({
        activity_type: (activityTypes as readonly string[]).includes(type) ? type : "task",
        work_category: key(v.work_category) || undefined,
        status: (activityStatuses as readonly string[]).includes(status) ? status : "open",
        owner_id: pending(3),
        contact_id: v.partner_odoo_id ? pending(1) : "",
        opportunity_id: v.deal_odoo_id ? pending(6) : "",
        related_person_name: v.related_person,
        related_organization_name: v.related_organization,
        remaining_work: v.remaining_work,
        occurred_at: occurred,
        notes: [v.summary, v.note].filter(Boolean).join("\n\n"),
      }),
    );
    if (v.partner_odoo_id && !contacts.has(v.partner_odoo_id))
      flag("activities", row, `partner_odoo_id: "${v.partner_odoo_id}" is not in the contacts file.`);
    const deal = v.deal_odoo_id ? deals.get(v.deal_odoo_id) : undefined;
    if (v.deal_odoo_id && !deal) flag("activities", row, `deal_odoo_id: "${v.deal_odoo_id}" is not in the deals file.`);
    // As for a form, an activity on a deal may name only the deal's party or its contact person.
    if (
      deal &&
      v.partner_odoo_id &&
      ![deal.values.partner_odoo_id, deal.values.contact_odoo_id].includes(v.partner_odoo_id)
    )
      flag("activities", row, "partner_odoo_id: must be the deal's partner or its contact person.");
    const assigned = owner("activities", row, v.assigned_to, "assigned_to");
    if (data) checked.activities.push({ row, data, owner: assigned });
  }

  for (const file of Object.keys(files) as FileKey[]) {
    const flagged = new Set(findings.filter(f => f.file === file).map(f => f.line));
    files[file].ready = usable[file].filter(row => !flagged.has(row.line)).length;
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const report: DryRunReport = { files, findings, offline: !reference };
  return { report, checked };
}
