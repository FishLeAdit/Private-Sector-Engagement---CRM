import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import type { FileKey } from "../../src/features/odoo/columns";
import { parseCsv } from "../../src/features/odoo/csv";
import { checkTables } from "../../src/features/odoo/dry-run";
import { importRows, type ImportRows } from "../../src/features/odoo/import-plan";
import type { Reference } from "../../src/features/odoo/types";

let db: PGlite;
const staff = ["Farzana Rahman", "Tanvir Hasan", "Nusrat Jahan", "Arif Chowdhury", "Sadia Islam"];
beforeAll(async () => {
  db = await createLocalDatabase();
  // The ready samples assign work to the named demo staff.
  for (const [i, name] of staff.entries()) {
    const id = `00000000-0000-4000-8000-0000000001${String(i).padStart(2, "0")}`;
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `staff${i}@fictional.example`]);
    await db.query(
      "insert into public.profiles (id, display_name, department, role) values ($1,$2,'PSE','pse_member')",
      [id, name],
    );
  }
});
afterAll(async () => {
  await db?.close();
});
const ready = () =>
  Object.fromEntries(
    (["contacts", "deals", "activities"] as FileKey[]).map(file => [
      file,
      parseCsv(readFileSync(`public/odoo-templates/ready/odoo-${file}.csv`, "utf8")),
    ]),
  ) as Record<FileKey, ReturnType<typeof parseCsv>>;
// The same reads as features/odoo/reference.ts, straight from SQL.
async function reference(): Promise<Reference> {
  // Typed by the caller: each query selects exactly the reference fields it fills.
  const rows = <T>(sql: string) => db.query<T>(sql).then(result => result.rows);
  const odooIds = (table: string) =>
    db
      .query<{ odoo_id: string }>(`select odoo_id from public.${table} where odoo_id is not null`)
      .then(r => r.rows.map(x => x.odoo_id));
  return {
    contacts: await rows<Reference["contacts"][number]>(
      "select name,email_normalized,phone_normalized from public.contacts",
    ),
    owners: await rows<Reference["owners"][number]>(
      "select id,display_name,active from public.profiles where department='PSE' and role in ('pse_member','pse_manager','admin')",
    ),
    stages: await rows<Reference["stages"][number]>("select id,name,active from public.pipeline_stages"),
    categories: await rows<Reference["categories"][number]>(
      "select id,code,name,active from public.contribution_categories",
    ),
    imported: {
      contacts: await odooIds("contacts"),
      deals: await odooIds("opportunities"),
      activities: await odooIds("activities"),
    },
  };
}
const run = (actor: string, rows: ImportRows) =>
  asActor(db, actor, tx =>
    tx.query<{ result: Record<string, number> }>("select public.import_odoo($1::jsonb,$2::jsonb,$3::jsonb) as result", [
      JSON.stringify(rows.contacts),
      JSON.stringify(rows.deals),
      JSON.stringify(rows.activities),
    ]),
  ).then(result => result.rows[0].result);
const count = (table: string) =>
  db
    .query<{ n: number }>(`select count(*)::int as n from public.${table} where odoo_id is not null`)
    .then(r => r.rows[0].n);

describe("Odoo import", () => {
  it("refuses members, as the app does", async () => {
    const { checked } = checkTables(ready(), await reference());
    await expect(run(ids.member, importRows(checked))).rejects.toMatchObject({ code: "42501" });
    expect(await count("contacts")).toBe(0);
  });
  it("rolls the whole batch back when one row is refused", async () => {
    const { checked } = checkTables(ready(), await reference());
    const rows = importRows(checked);
    // An activity naming someone who is not on its deal fails the link trigger, after every contact went in.
    rows.activities[0].contact_id = rows.contacts.find(c => c.odoo_id === "res_partner_305")!.id;
    await expect(run(ids.manager, rows)).rejects.toMatchObject({ code: "23514" });
    for (const table of ["contacts", "opportunities", "activities"]) expect(await count(table)).toBe(0);
  });
  it("imports the ready samples with their links, staff and the importer as creator", async () => {
    const { report, checked } = checkTables(ready(), await reference());
    expect(report.findings).toEqual([]);
    const rows = importRows(checked);
    expect(await run(ids.manager, rows)).toEqual({ contacts: 5, deals: 4, activities: 5 });
    const person = await db.query<Record<string, unknown>>(
      "select c.kind, p.odoo_id as company, c.created_by from public.contacts c join public.contacts p on p.id=c.company_id where c.odoo_id='res_partner_304'",
    );
    expect(person.rows).toEqual([{ kind: "individual", company: "res_partner_303", created_by: ids.manager }]);
    const deal = await db.query<Record<string, unknown>>(
      "select o.expected_amount::text as amount, o.contribution_type, s.name as stage, p.display_name as owner from public.opportunities o join public.pipeline_stages s on s.id=o.stage_id join public.profiles p on p.id=o.owner_id where o.odoo_id='crm_lead_402'",
    );
    expect(deal.rows).toEqual([
      { amount: "150000.50", contribution_type: "valued_in_kind", stage: "Submitted", owner: "Tanvir Hasan" },
    ]);
    const activity = await db.query<Record<string, unknown>>(
      "select a.activity_type, a.status, o.odoo_id as deal from public.activities a join public.opportunities o on o.id=a.opportunity_id where a.odoo_id='mail_activity_502'",
    );
    expect(activity.rows).toEqual([{ activity_type: "meeting", status: "open", deal: "crm_lead_402" }]);
  });
  it("blocks a second import of the same files, in the check and in the database", async () => {
    const { report, checked } = checkTables(ready(), await reference());
    expect(report.findings.filter(f => f.message.startsWith("odoo_id: already imported"))).toHaveLength(14);
    expect(report.findings.some(f => f.message.includes("matches the existing CRM contact"))).toBe(true);
    // Even past the check, the unique Odoo IDs and contact emails refuse the batch.
    await expect(run(ids.manager, importRows(checked))).rejects.toMatchObject({ code: "23505" });
    expect(await count("contacts")).toBe(5);
  });
});
