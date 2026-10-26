import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import type { AccessResult } from "../../src/lib/auth/session";
import type { OpportunityOptions, OpportunityRecord, OpportunityRepository, Party } from "../../src/features/opportunities/types";
import { opportunityPatchSchema, opportunitySchema } from "../../src/features/opportunities/schemas";
import { formatCents, toCents } from "../../src/lib/currency";
vi.mock("server-only", () => ({}));
import { createOpportunitiesService } from "../../src/features/opportunities/service";

let db: PGlite;
beforeAll(async () => { db = await createLocalDatabase(); });
afterAll(async () => { await db?.close(); });
const stage = "70000000-0000-4000-8000-000000000001", won = "70000000-0000-4000-8000-000000000006", category = "80000000-0000-4000-8000-000000000001";
function access(actor: string, role: "pse_member" | "pse_manager" = "pse_member"): AccessResult {
  return { status: "allowed", userId: actor, profile: { id: actor, display_name: "Fictional", active: true, department: "PSE", role } };
}
const payload = (extra = {}) => ({ deal_name: "Fictional expected donation", owner_id: ids.member, contact_id: ids.individual, stage_id: stage, contribution_type: "cash", contribution_category_id: category, expected_amount: "1234.56", ...extra });

// Local SQL adapter exercises the actual service plus PostgreSQL/RLS. The real
// Supabase request builder has separate SDK contract tests, never hosted writes.
function repository(actor: string, database: PGlite = db): OpportunityRepository {
  const query = <T>(sql: string, params: unknown[] = []) => asActor(database, actor, tx => tx.query<T>(sql, params));
  const selection = `select o.*, o.expected_close_at::text as expected_close_at,
    to_jsonb(c) as contact, to_jsonb(p) as primary_contact, to_jsonb(s) as secondary_contact,
    to_jsonb(owner) as owner, to_jsonb(stage) as stage, to_jsonb(category) as category
    from public.opportunities o left join public.contacts c on c.id=o.contact_id
    left join public.contacts p on p.id=o.primary_contact_id left join public.contacts s on s.id=o.secondary_contact_id
    left join public.profiles owner on owner.id=o.owner_id left join public.pipeline_stages stage on stage.id=o.stage_id
    left join public.contribution_categories category on category.id=o.contribution_category_id`;
  const columns = ["deal_name", "owner_id", "contact_id", "primary_contact_id", "secondary_contact_id", "stage_id", "contribution_type", "contribution_category_id", "expected_amount", "operational_budget", "currency", "payment_interval", "expected_close_at", "country", "description", "notes", "drive_urls", "valuation_note", "valuation_reference_url"];
  async function find(id: string) { return (await query<OpportunityRecord>(`${selection} where o.id=$1`, [id])).rows[0] ?? null; }
  return {
    find,
    async contact(id) { return (await query<Party>("select id,name,kind,email,phone,website from public.contacts where id=$1", [id])).rows[0] ?? null; },
    async options() {
      return { stages: (await query<OpportunityOptions["stages"][number]>("select * from public.pipeline_stages order by position")).rows,
        categories: (await query<OpportunityOptions["categories"][number]>("select * from public.contribution_categories")).rows,
        owners: (await query<OpportunityOptions["owners"][number]>("select id,display_name,active from public.profiles where department='PSE' and role in ('pse_member','pse_manager','admin')")).rows };
    },
    async list() { const opportunities = (await query<OpportunityRecord>(selection)).rows; return { opportunities, count: opportunities.length }; },
    async create(input, creator) {
      const result = await query<{ id: string }>(`insert into public.opportunities(${columns.join(",")},created_by)
        select ${columns.map(key => `x.${key}`).join(",")},$2::uuid from jsonb_populate_record(null::public.opportunities,$1::jsonb) x returning id`, [JSON.stringify(input), creator]);
      return (await find(result.rows[0].id))!;
    },
    async update(id, input) {
      const result = await query(`update public.opportunities set (${columns.join(",")})=(select ${columns.map(key => `x.${key}`).join(",")} from jsonb_populate_record(null::public.opportunities,$1::jsonb) x) where id=$2 returning id`, [JSON.stringify(input), id]);
      return result.rows.length ? find(id) : null;
    },
    async history(id) {
      return { contributions: (await query<Awaited<ReturnType<OpportunityRepository["history"]>>["contributions"][number]>("select * from public.recognized_contributions where opportunity_id=$1", [id])).rows,
        audits: (await query<Awaited<ReturnType<OpportunityRepository["history"]>>["audits"][number]>("select a.*,json_build_object('display_name',p.display_name) as actor from public.audit_logs a left join public.profiles p on p.id=a.actor_id where entity='opportunities' and entity_id=$1", [id])).rows };
    },
    async saveStage(input, id) {
      if (id) await query("update public.pipeline_stages set name=$1,position=$2,outcome=$3,is_closed=$4,active=$5,is_provisional=$6 where id=$7", [input.name,input.position,input.outcome,input.is_closed,input.active,input.is_provisional,id]);
      else await query("insert into public.pipeline_stages(name,position,outcome,is_closed,active,is_provisional) values($1,$2,$3,$4,$5,$6)", [input.name,input.position,input.outcome,input.is_closed,input.active,input.is_provisional]);
    },
    async saveCategory(input, id) {
      if (id) await query("update public.contribution_categories set code=$1,name=$2,active=$3,is_provisional=$4 where id=$5", [input.code,input.name,input.active,input.is_provisional,id]);
      else await query("insert into public.contribution_categories(code,name,active,is_provisional) values($1,$2,$3,$4)", [input.code,input.name,input.active,input.is_provisional]);
    },
  };
}
function service(actor: string = ids.member, role: "pse_member" | "pse_manager" = "pse_member") { return createOpportunitiesService(repository(actor), access(actor, role)); }

describe("financial opportunity workflow", () => {
  it("creates an individual financial deal with all original optional fields", async () => {
    const row = await service().create(payload({ operational_budget: "0.00", payment_interval: "quarterly", expected_close_at: "2027-02-28", country: "Bangladesh", description: "Fictional project", notes: "https://drive.google.com/file/d/demo/view", drive_urls: ["https://drive.google.com/file/d/demo/view", ""] }));
    expect(row.created_by).toBe(ids.member); expect(row.contact?.id).toBe(ids.individual);
    expect(Number(row.expected_amount)).toBe(1234.56); expect(Number(row.operational_budget)).toBe(0);
    expect(row.expected_close_at).toBe("2027-02-28"); expect(row.drive_urls).toHaveLength(1);
    const updated = await service().update(row.id, { notes: "Only notes changed" });
    expect(updated.expected_close_at).toBe("2027-02-28"); expect(updated.payment_interval).toBe("quarterly"); expect(Number(updated.expected_amount)).toBe(1234.56);
    expect(opportunityPatchSchema.parse({ notes: "Only notes changed" })).toEqual({ notes: "Only notes changed" });
  });
  it("requires company primary contact, includes both people and permits an omitted secondary", async () => {
    await expect(service().create(payload({ contact_id: ids.company }))).rejects.toMatchObject({ status: 422, fields: { primary_contact_id: expect.any(Array) } });
    const company = await service().create(payload({ contact_id: ids.company, primary_contact_id: ids.person, secondary_contact_id: ids.secondary }));
    expect(company.contact?.website).toBeTruthy(); expect(company.primary_contact?.email).toBeTruthy(); expect(company.secondary_contact?.phone).toBeTruthy();
    expect((await service().create(payload({ contact_id: ids.company, primary_contact_id: ids.person }))).secondary_contact_id).toBeNull();
  });
  it("rejects duplicate or incompatible contact people", async () => {
    await expect(service().create(payload({ contact_id: ids.company, primary_contact_id: ids.company }))).rejects.toMatchObject({ status: 422 });
    await expect(service().create(payload({ contact_id: ids.company, primary_contact_id: ids.person, secondary_contact_id: ids.person }))).rejects.toMatchObject({ status: 422 });
    await expect(service().create(payload({ secondary_contact_id: ids.secondary }))).rejects.toMatchObject({ status: 422 });
  });
  it.each(["", "0", "-1", "NaN", "Infinity", "12.345", "1000000000000", "1e3"])("rejects non-financial/invalid expected value %s", async expected_amount => {
    await expect(service().create(payload({ expected_amount }))).rejects.toMatchObject({ status: 422 });
  });
  it("retains a manual in-kind valuation without recording actual achievement", async () => {
    await expect(service().create(payload({ contribution_type: "valued_in_kind" }))).rejects.toMatchObject({ status: 422 });
    const row = await service().create(payload({ contribution_type: "valued_in_kind", valuation_note: "Agreed with PSE from fictional operations inventory", valuation_reference_url: "https://drive.google.com/file/d/inventory/view" }));
    expect(row.valuation_note).toContain("operations inventory"); expect((await service().details(row.id)).history.contributions).toEqual([]);
  });
  it("audits stage transitions and never creates actuals on Won", async () => {
    const row = await service().create(payload({ operational_budget: "100.01" }));
    await service().update(row.id, { stage_id: won });
    const { opportunity, history } = await service().details(row.id);
    expect(opportunity.stage?.outcome).toBe("won"); expect(Number(opportunity.operational_budget)).toBe(100.01); expect(history.contributions).toEqual([]);
    expect(history.audits.some(entry => entry.action === "update" && JSON.stringify(entry.before).includes(stage) && JSON.stringify(entry.after).includes(won))).toBe(true);
  });
  it("permits colleague reads, denies unrelated edits, and allows managers to reassign", async () => {
    const row = await service().create(payload());
    expect((await service(ids.colleague).get(row.id)).id).toBe(row.id);
    await expect(service(ids.colleague).update(row.id, { notes: "Forbidden" })).rejects.toMatchObject({ status: 403 });
    await expect(service().update(row.id, { owner_id: ids.colleague })).rejects.toMatchObject({ status: 403 });
    await expect(service().create(payload({ owner_id: ids.colleague }))).rejects.toMatchObject({ status: 403 });
    await service(ids.manager, "pse_manager").update(row.id, { owner_id: ids.colleague });
    expect((await service(ids.colleague).update(row.id, { notes: "Focal person edit" })).notes).toBe("Focal person edit");
    expect((await service().update(row.id, { notes: "Creator edit" })).notes).toBe("Creator edit");
  });
  it("rejects inactive/non-PSE owners and identity mass-assignment", async () => {
    for (const owner_id of [ids.outsider, ids.inactive]) await expect(service(ids.manager, "pse_manager").create(payload({ owner_id }))).rejects.toMatchObject({ status: 422 });
    await expect(service().create(payload({ created_by: ids.manager }))).rejects.toMatchObject({ status: 422 });
    await expect(service().update(ids.cashOpportunity, { id: ids.usdOpportunity })).rejects.toMatchObject({ status: 422 });
  });
  it("preserves currency/type attribution of existing realized contributions", async () => {
    await expect(service().update(ids.cashOpportunity, { currency: "USD" })).rejects.toThrow();
    await expect(service().update(ids.cashOpportunity, { contribution_type: "valued_in_kind", valuation_note: "Fictional" })).rejects.toThrow();
  });
  it("preserves meeting/activity contact compatibility on opportunity edits", async () => {
    await asActor(db, ids.member, tx => tx.query("insert into public.activities(activity_type,owner_id,contact_id,opportunity_id) values('call',$1,$2,$3)", [ids.member,ids.secondary,ids.cashOpportunity]));
    await expect(service().update(ids.cashOpportunity, { secondary_contact_id: "" })).rejects.toThrow();
  });
  it("lets managers configure data-driven stages/categories; members cannot configure", async () => {
    const change = { entity: "stage", values: { name: "Fictional review stage", position: 50, outcome: "open", active: true, is_provisional: true } };
    await expect(service().configure(change)).rejects.toMatchObject({ status: 403 });
    const manager = service(ids.manager, "pse_manager");
    const options = await manager.configure(change), review = options.stages.find(row => row.name === "Fictional review stage")!;
    const row = await service().create(payload({ stage_id: review.id }));
    await manager.configure({ ...change, id: review.id, values: { ...change.values, active: false } });
    expect((await service().update(row.id, { notes: "Historical edit" })).stage_id).toBe(review.id);
    await expect(service().create(payload({ stage_id: review.id }))).rejects.toMatchObject({ status: 422 });
    const custom = await manager.configure({ entity: "category", values: { name: "Fictional local category", code: "LOCAL_DEMO", active: true, is_provisional: true } });
    expect(custom.categories.some(row => row.code === "LOCAL_DEMO")).toBe(true);
    const before = custom.stages.length;
    expect((await manager.configure({ entity: "starter" })).stages).toHaveLength(before);
    expect((await manager.configure({ entity: "starter" })).categories).toHaveLength(custom.categories.length);
  });
  it("enforces database ownership and manager configuration policies independently of services", async () => {
    const row = await service().create(payload());
    expect((await asActor(db, ids.colleague, tx => tx.query("update public.opportunities set notes='Unauthorized' where id=$1 returning id", [row.id]))).rows).toEqual([]);
    await expect(asActor(db, ids.member, tx => tx.query("insert into public.pipeline_stages(name,position) values('Unauthorized',99)"))).rejects.toThrow();
    for (const actor of [ids.outsider, ids.inactive]) expect((await repository(actor).list({} as never)).opportunities).toEqual([]);
  });
  it("initializes an empty project with explicitly provisional examples and can be retried", async () => {
    const empty = await createLocalDatabase({ seed: false });
    try {
      await empty.query("insert into auth.users(id,email) values($1,'fictional-manager@example.invalid')", [ids.manager]);
      await empty.query("insert into public.profiles(id,display_name,department,role,active) values($1,'Fictional Manager','PSE','pse_manager',true)", [ids.manager]);
      const manager = createOpportunitiesService(repository(ids.manager, empty), access(ids.manager, "pse_manager"));
      const configured = await manager.configure({ entity: "starter" });
      expect(configured.stages).toHaveLength(8); expect(configured.categories).toHaveLength(6);
      expect(configured.stages.every(row => row.active && row.is_provisional)).toBe(true);
      expect(configured.stages.find(row => row.name === "Won")).toMatchObject({ outcome: "won", is_closed: true });
      expect((await manager.configure({ entity: "starter" })).stages).toHaveLength(8);
    } finally { await empty.close(); }
  });
  it.each(["anonymous", "forbidden", "unavailable"] as const)("rejects %s access before queries", async status => {
    const repo = repository(ids.member), find = vi.spyOn(repo, "find");
    await expect(createOpportunitiesService(repo, { status }).get(ids.cashOpportunity)).rejects.toBeInstanceOf(Error); expect(find).not.toHaveBeenCalled();
  });
  it("validates dates, budgets and safe references and sums decimal currency values exactly", () => {
    for (const extra of [{ expected_close_at: "2026-02-30" }, { operational_budget: "-0.01" }, { valuation_reference_url: "javascript:alert(1)" }, { drive_urls: ["file:///local"] }]) expect(opportunitySchema.safeParse(payload(extra)).success).toBe(false);
    expect(formatCents(toCents("0.10") + toCents("0.20"), "BDT")).toBe("BDT 0.30");
    expect(formatCents(toCents("999999999999.99"), "USD")).toBe("USD 999,999,999,999.99");
  });
});
