import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { columns, type FileKey } from "../../src/features/odoo/columns";
import { CsvError, parseCsv } from "../../src/features/odoo/csv";
import { checkTables, dryRun } from "../../src/features/odoo/dry-run";
import { importRows } from "../../src/features/odoo/import-plan";
import { formatReport } from "../../src/features/odoo/report";
import type { Reference } from "../../src/features/odoo/types";

const template = (file: FileKey, set = "mixed") =>
  parseCsv(readFileSync(`public/odoo-templates/${set}/odoo-${file}.csv`, "utf8"));
const templates = (set = "mixed") => ({
  contacts: template("contacts", set),
  deals: template("deals", set),
  activities: template("activities", set),
});
const reference: Reference = {
  contacts: [{ name: "Existing Fictional Donor", email_normalized: null, phone_normalized: "8801800000103" }],
  owners: ["Farzana Rahman", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"].map((name, i) => ({
    id: `o${i}`,
    display_name: name,
    active: true,
  })),
  stages: ["New", "Scoping", "Preparation", "Submitted"].map(name => ({ id: name, name, active: true })),
  categories: [
    { id: "c1", code: "DSP", name: "Digital School Program", active: true },
    { id: "c2", code: "SAC", name: "Sponsor a Child", active: true },
    { id: "c3", code: "EVENT_CAMPAIGN", name: "Event & Campaign", active: true },
  ],
  imported: { contacts: [], deals: [], activities: [] },
};
const messages = (report: ReturnType<typeof dryRun>, file: FileKey, line: number) =>
  report.findings.filter(f => f.file === file && f.line === line).map(f => f.message);

describe("CSV reader", () => {
  it("handles a BOM, CRLF, quoted commas, line breaks and doubled quotes, and reports start lines", () => {
    const table = parseCsv('﻿Name,Note\r\n"Doe, Jane","Line one\nline ""two"""\r\n\r\nSolo,plain\r\n');
    expect(table.headers).toEqual(["name", "note"]);
    expect(table.rows).toEqual([
      { line: 2, values: { name: "Doe, Jane", note: 'Line one\nline "two"' }, extra: 0 },
      { line: 5, values: { name: "Solo", note: "plain" }, extra: 0 },
    ]);
  });
  it("counts surplus values and refuses an unclosed quote", () => {
    expect(parseCsv("a,b\n1,2,3").rows[0].extra).toBe(1);
    expect(() => parseCsv('a\n"open')).toThrow(CsvError);
  });
});

describe("Odoo dry run on the fictional templates", () => {
  it("checks every row offline without the project's staff, stages or categories", () => {
    const report = dryRun(templates(), null);
    expect(report.files.contacts).toMatchObject({ rows: 5, ready: 3, missing: [] });
    expect(report.files.deals).toMatchObject({ rows: 4, ready: 3 });
    expect(report.files.activities).toMatchObject({ rows: 4, ready: 3 });
    expect(messages(report, "contacts", 5)).toEqual([
      "email: same as line 3 (res_partner_102); review before merging.",
    ]);
    expect(messages(report, "contacts", 6)).toContain("email: Provide an email address or phone number.");
    expect(messages(report, "deals", 5)).toEqual(
      expect.arrayContaining([
        "expected_revenue: Enter an expected financial value greater than zero.",
        "contact_odoo_id: a company deal needs its individual contact person.",
      ]),
    );
    expect(report.findings.some(f => /salesperson|stage|tag|existing CRM/.test(f.message))).toBe(false);
    expect(formatReport(report)).toContain("Offline: staff, stage, category and existing-contact checks were skipped.");
  });
  it("matches staff, stages, tags and existing contacts against the project", () => {
    const report = dryRun(templates(), reference);
    expect(messages(report, "contacts", 4)).toEqual([
      'phone: matches the existing CRM contact "Existing Fictional Donor".',
    ]);
    expect(messages(report, "deals", 3)).toEqual([]); // tag matched by name, stage by name
    expect(messages(report, "deals", 4)).toEqual([
      'salesperson: "Demo Manager" is not an active PSE profile; map it to one before import.',
      'stage: "Qualified" is not an active pipeline stage; map it to one before import.',
    ]);
    const twins = {
      ...reference,
      owners: [...reference.owners, { id: "x", display_name: "Nusrat Jahan", active: true }],
    };
    expect(messages(dryRun(templates(), twins), "deals", 2)).toEqual([
      'salesperson: "Nusrat Jahan" matches 2 PSE profiles; make the names distinct.',
    ]);
    expect(messages(report, "activities", 5)).toEqual(
      expect.arrayContaining([
        'date: "2026-11-31" is not a YYYY-MM-DD [HH:MM] date.',
        'activity_type: "Lunch" has no CRM activity type mapped.',
        'partner_odoo_id: "res_partner_999" is not in the contacts file.',
        'deal_odoo_id: "crm_lead_999" is not in the deals file.',
        'assigned_to: "Nobody Here" is not an active PSE profile; map it to one before import.',
      ]),
    );
    expect(report.files.deals.ready).toBe(2);
  });
  it("maps Odoo's activity names and reads dates as Asia/Dhaka time", () => {
    const report = dryRun(templates(), reference);
    for (const line of [2, 3, 4]) expect(messages(report, "activities", line)).toEqual([]);
  });
  it("skips a file that lacks its columns and flags repeated or missing Odoo IDs", () => {
    const tables = templates();
    tables.activities = parseCsv("odoo_id,summary\nx,y");
    const header = columns.contacts.join(",");
    tables.contacts = parseCsv(
      `${header}\nres_partner_101,TRUE,A,,,a@fictional.example,,,,,\nres_partner_101,TRUE,B,,,b@fictional.example,,,,,\n,FALSE,C,,,c@fictional.example,,,,,`,
    );
    const report = dryRun(tables, null);
    expect(report.files.activities).toMatchObject({ rows: 1, ready: 0, ignored: [] });
    expect(report.files.activities.missing).toContain("activity_type");
    expect(messages(report, "contacts", 3)).toEqual(["odoo_id: also used on line 2."]);
    expect(messages(report, "contacts", 4)).toEqual(["odoo_id: required, so other files can refer to this row."]);
  });
});

describe("ready samples and import rows", () => {
  it("finds nothing to review in the ready samples", () => {
    const report = dryRun(templates("ready"), reference);
    expect(report.findings).toEqual([]);
    expect(Object.values(report.files).map(f => [f.rows, f.ready])).toEqual([
      [5, 5],
      [4, 4],
      [5, 5],
    ]);
  });
  it("refuses rows already imported and an activity naming someone outside its deal", () => {
    const imported = { contacts: ["res_partner_302"], deals: ["crm_lead_401"], activities: [] };
    const tables = templates("ready");
    tables.activities.rows[0].values.partner_odoo_id = "res_partner_305";
    const report = dryRun(tables, { ...reference, imported });
    expect(messages(report, "contacts", 3)).toEqual([
      "odoo_id: already imported into the CRM; importing it again would duplicate it.",
    ]);
    expect(messages(report, "deals", 2)).toHaveLength(1);
    expect(messages(report, "activities", 2)).toEqual([
      "partner_odoo_id: must be the deal's partner or its contact person.",
    ]);
  });
  it("builds linked rows with resolved staff, stages and categories", () => {
    let n = 0;
    const rows = importRows(checkTables(templates("ready"), reference).checked, () => `id-${++n}`);
    const byOdoo = (list: { odoo_id: string; id: string }[], id: string) => list.find(r => r.odoo_id === id)!;
    const company = byOdoo(rows.contacts, "res_partner_303"),
      person = rows.contacts.find(r => r.odoo_id === "res_partner_304")!;
    expect(person).toMatchObject({ kind: "individual", company_id: company.id, phone: "+880 1800 000304" });
    expect(person.notes).toBe("Prefers WhatsApp for quick questions\nMobile: +880 1900 000304");
    const deal = rows.deals.find(r => r.odoo_id === "crm_lead_402")!;
    expect(deal).toMatchObject({
      contact_id: company.id,
      primary_contact_id: person.id,
      owner_id: "o1",
      stage_id: "Submitted",
      contribution_category_id: "c1",
      contribution_type: "valued_in_kind",
      expected_amount: "150000.50",
    });
    expect(rows.deals.find(r => r.odoo_id === "crm_lead_403")).toMatchObject({ primary_contact_id: null });
    const activity = rows.activities.find(r => r.odoo_id === "mail_activity_502")!;
    expect(activity).toMatchObject({
      activity_type: "meeting",
      status: "open",
      contact_id: person.id,
      opportunity_id: deal.id,
    });
    expect(activity.occurred_at).toBe("2026-11-04T09:30:00.000Z"); // 15:30 in Asia/Dhaka
    expect(rows.activities.find(r => r.odoo_id === "mail_activity_504")).toMatchObject({
      activity_type: "task",
      contact_id: null,
      opportunity_id: null,
      related_organization_name: "Fictional Primary School",
    });
  });
});

describe("the dry-run command", () => {
  it("only reads from Supabase", () => {
    for (const file of ["scripts/odoo-dry-run.ts", "src/features/odoo/reference.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
    }
    expect(readFileSync("src/features/odoo/reference.ts", "utf8")).toContain(".select(");
  });
});
