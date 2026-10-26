import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import { buildDemoData, checkDemoContacts, chooseDemoOwner, DEMO_MARKER, demoContactIds, demoLookupRows, demoOpportunityIds } from "../../scripts/lib/demo-data";

const examples = demoLookupRows(), today = new Date("2026-10-26T12:00:00Z");
const dataset = () => buildDemoData(ids.manager, examples.stages, examples.categories, today);
let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase();
  // Reuse configured lookup IDs from the migrated/seeded local database.
  for (const stage of examples.stages) stage.id = (await db.query<{ id: string }>("select id from public.pipeline_stages where name=$1", [stage.name])).rows[0].id;
  for (const category of examples.categories) category.id = (await db.query<{ id: string }>("select id from public.contribution_categories where code=$1", [category.code])).rows[0].id;
});
afterAll(async () => { await db?.close(); });
async function insertDemo() {
  const data = dataset();
  await asActor(db, ids.manager, async tx => {
    for (const [table, rows] of [["contacts", data.companies], ["contacts", data.people], ["opportunities", data.opportunities]] as const) {
      for (const row of rows) {
        const columns = Object.keys(row);
        await tx.query(`insert into public.${table}(${columns.join(",")}) select ${columns.map(key => `x.${key}`).join(",")} from jsonb_populate_record(null::public.${table},$1::jsonb) x on conflict(id) do nothing`, [JSON.stringify(row)]);
      }
    }
  });
}
describe("hosted demonstration seed preparation", () => {
  it("builds labeled fictional contacts and financially valued opportunities", () => {
    const data = dataset(), contacts = [...data.companies, ...data.people];
    expect(data.companies).toHaveLength(3); expect(data.people).toHaveLength(8); expect(data.opportunities).toHaveLength(8);
    expect(new Set(contacts.map(row => row.id)).size).toBe(11);
    expect(contacts.every(row => row.name.startsWith("Demo | ") && row.notes?.includes(DEMO_MARKER))).toBe(true);
    expect(contacts.every(row => !row.email || row.email.endsWith("@example.invalid"))).toBe(true);
    expect(contacts.every(row => !row.phone || /^\+1 202 555 01\d\d$/.test(row.phone))).toBe(true);
    expect(data.opportunities.every(row => row.expected_amount > 0 && row.created_by === ids.manager && row.owner_id === ids.manager)).toBe(true);
    expect(new Set(data.opportunities.map(row => row.stage_id)).size).toBe(8);
    expect(new Set(data.opportunities.map(row => row.currency))).toEqual(new Set(["BDT", "USD"]));
    expect(data.opportunities.find(row => row.contribution_type === "valued_in_kind")?.valuation_note).toContain("operational-team");
  });
  it("uses active custom stages/categories without creating or renaming configuration", () => {
    const customStage = { ...examples.stages[0], name: "Team review", id: "70000000-0000-4000-8000-000000000099" }, customCategory = { ...examples.categories[0], code: "LOCAL" };
    const data = buildDemoData(ids.manager, [customStage], [customCategory], today);
    expect(data.opportunities.every(row => row.stage_id === customStage.id && row.contribution_category_id === customCategory.id)).toBe(true);
    expect(customStage.name).toBe("Team review");
    expect(() => buildDemoData(ids.manager, [{ ...customStage, active: false }], [customCategory])).toThrow(/active stage/);
  });
  it("selects an existing active PSE manager or explicitly selected member without creating identities", () => {
    const profiles = [
      { id: ids.outsider, display_name: "Fictional HR", department: "HR", role: "admin", active: true },
      { id: ids.inactive, display_name: "Fictional Inactive", department: "PSE", role: "pse_manager", active: false },
      { id: ids.member, display_name: "Fictional Member", department: "PSE", role: "pse_member", active: true },
      { id: ids.manager, display_name: "Fictional Manager", department: "PSE", role: "pse_manager", active: true },
    ];
    expect(chooseDemoOwner(profiles).id).toBe(ids.manager); expect(chooseDemoOwner(profiles, ids.member).id).toBe(ids.member);
    expect(() => chooseDemoOwner(profiles, ids.outsider)).toThrow(/active PSE/); expect(() => chooseDemoOwner([])).toThrow(/active PSE/);
  });
  it("rejects email/phone conflicts with a different contact before inserting", () => {
    const rows = dataset().companies, first = rows[0];
    expect(() => checkDemoContacts(rows, [{ id: ids.company, email_normalized: first.email!, phone_normalized: null }])).toThrow(/No records were changed/);
    expect(() => checkDemoContacts(rows, [{ id: ids.company, email_normalized: null, phone_normalized: first.phone!.replace(/[^0-9]/g, "") }])).toThrow(/No records were changed/);
    expect(() => checkDemoContacts(rows, [{ id: first.id!, email_normalized: first.email!, phone_normalized: null }])).not.toThrow();
  });
  it("persists valid company/person/deal relationships under PSE RLS and permits team reads", async () => {
    await insertDemo();
    const contacts = await asActor(db, ids.member, tx => tx.query("select id from public.contacts where id=any($1::uuid[])", [demoContactIds]));
    const deals = await asActor(db, ids.member, tx => tx.query<{ id: string; kind: string; primary_kind: string | null; secondary_kind: string | null }>(`select o.id,c.kind,p.kind as primary_kind,s.kind as secondary_kind
      from public.opportunities o join public.contacts c on c.id=o.contact_id left join public.contacts p on p.id=o.primary_contact_id
      left join public.contacts s on s.id=o.secondary_contact_id where o.id=any($1::uuid[])`, [demoOpportunityIds]));
    expect(contacts.rows).toHaveLength(11); expect(deals.rows).toHaveLength(8);
    expect(deals.rows.filter(row => row.kind === "company").every(row => row.primary_kind === "individual" && row.secondary_kind === "individual")).toBe(true);
    expect((await asActor(db, ids.outsider, tx => tx.query("select id from public.contacts where id=any($1::uuid[])", [demoContactIds]))).rows).toEqual([]);
  });
  it("can be repeated without overwriting edited rows or adding actuals, users or targets", async () => {
    await asActor(db, ids.manager, tx => tx.query("update public.contacts set name='Demo | Edited in the app' where id=$1", [demoContactIds[0]]));
    await asActor(db, ids.manager, tx => tx.query("update public.opportunities set expected_amount=12345 where id=$1", [demoOpportunityIds[0]]));
    await insertDemo();
    expect((await db.query<{ name: string }>("select name from public.contacts where id=$1", [demoContactIds[0]])).rows[0].name).toBe("Demo | Edited in the app");
    expect((await db.query<{ expected_amount: string }>("select expected_amount::text from public.opportunities where id=$1", [demoOpportunityIds[0]])).rows[0].expected_amount).toBe("12345.00");
    const counts = (await db.query("select (select count(*)::int from public.profiles) as profiles,(select count(*)::int from public.target_plans) as targets,(select count(*)::int from public.recognized_contributions) as actuals")).rows[0];
    expect(counts).toEqual({ profiles: 5, targets: 2, actuals: 3 });
    expect((await db.query("select id from public.opportunities where id=any($1::uuid[])", [demoOpportunityIds])).rows).toHaveLength(8);
  });
});
