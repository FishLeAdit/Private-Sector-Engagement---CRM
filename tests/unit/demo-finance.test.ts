import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import {
  buildDemoFinance,
  demoFinanceYears,
  demoFinanceVerticals,
  demoTargetIds,
  demoContributionIds,
} from "../../scripts/lib/demo-finance";
import { cents, targetPerformance } from "../../src/lib/money";
let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});
const manager = {
  id: ids.manager,
  display_name: "Fictional Manager",
  department: "PSE",
  role: "pse_manager",
  active: true,
};
const member = {
  id: ids.member,
  display_name: "Fictional Member",
  department: "PSE",
  role: "pse_member",
  active: true,
};
const opportunities = [
  { id: ids.cashOpportunity, currency: "BDT", contribution_type: "cash" },
  { id: ids.inKindOpportunity, currency: "BDT", contribution_type: "valued_in_kind" },
  { id: ids.usdOpportunity, currency: "USD", contribution_type: "cash" },
];
const data = () => buildDemoFinance(manager, [manager, member], opportunities, [2035, 2036]);
async function adminSeed(id: string, values: unknown) {
  return db.transaction(async tx => {
    await tx.exec("set local role service_role");
    return tx.query<{ added: boolean }>("select public.seed_demo_target($1,$2::jsonb) as added", [
      id,
      JSON.stringify(values),
    ]);
  });
}
async function insertVerticals() {
  for (const row of demoFinanceVerticals)
    await db.query(
      "insert into public.target_verticals(id,code,name,active,is_provisional) values($1,$2,$3,true,true) on conflict(id) do nothing",
      [row.id, row.code, row.name],
    );
}
async function insertReceipts() {
  for (const row of data().contributions) {
    const keys = Object.keys(row);
    await db.query(
      `insert into public.recognized_contributions(${keys.join(",")}) select ${keys.map(k => `x.${k}`).join(",")} from jsonb_populate_record(null::public.recognized_contributions,$1::jsonb)x on conflict(id)do nothing`,
      [JSON.stringify(row)],
    );
  }
}
describe("fictional financial demo builder", () => {
  it("builds six receipts, distinct currencies, manual in-kind evidence and unassigned work", () => {
    const rows = data();
    expect(rows.contributions).toHaveLength(6);
    expect(rows.contributions.every(r => r.notes?.startsWith("Demo | ") && r.recorded_by === manager.id)).toBe(true);
    expect(rows.contributions.filter(r => r.currency === "BDT").reduce((sum, r) => sum + cents(r.amount), 0n)).toBe(
      cents("280000"),
    );
    expect(rows.contributions.find(r => r.contribution_type === "valued_in_kind")).toMatchObject({
      amount: 40000,
      approved_value_note: expect.stringContaining("operational-team"),
    });
    expect(rows.contributions.filter(r => !r.target_vertical_id)).toHaveLength(2);
  });
  it("creates a reconciled plan and an intentionally incomplete draft with separate employees", () => {
    const plans = data().plans;
    expect(plans[0].values.allocations).toHaveLength(12);
    expect(new Set(plans[0].values.allocations.map(a => a.employee_id)).size).toBe(2);
    expect(plans[1].values.allocations).toHaveLength(0);
    for (const quarter of plans[0].values.quarters)
      expect(
        plans[0].values.allocations
          .filter(a => a.quarter === quarter.quarter)
          .reduce((sum, a) => sum + cents(a.amount), 0n),
      ).toBe(cents(quarter.amount));
    expect(demoFinanceVerticals.every(v => v.is_provisional && v.name.startsWith("Demo | "))).toBe(true);
  });
  it("preserves existing target years and chooses free slots instead of overwriting manual plans", () => {
    expect(demoFinanceYears([{ id: ids.approvedPlan, year: 2026, currency: "BDT" }], 2026)).toEqual([2025, 2027]);
    expect(
      demoFinanceYears(
        [
          { id: demoTargetIds[0], year: 2024, currency: "BDT" },
          { id: demoTargetIds[1], year: 2028, currency: "BDT" },
        ],
        2026,
      ),
    ).toEqual([2024, 2028]);
  });
  it("requires an active manager and current existing parent types, without recreating deleted opportunities", () => {
    expect(() => buildDemoFinance(member, [member], opportunities, [2035, 2036])).toThrow(/manager/);
    expect(() => buildDemoFinance(manager, [manager], opportunities.slice(0, 1), [2035, 2036])).toThrow(/Existing BDT/);
    expect(data().plans[0].values.year).toBe(2035);
  });
});
describe("administrative seed permissions and persistence", () => {
  it.each([ids.manager, ids.member, ids.outsider, null])("denies seed RPC to ordinary app actor %s", async actor => {
    await expect(
      asActor(db, actor, tx =>
        tx.query("select public.seed_demo_target($1,$2::jsonb)", [
          demoTargetIds[0],
          JSON.stringify(data().plans[0].values),
        ]),
      ),
    ).rejects.toThrow(/permission/i);
  });
  it("inserts a complete plan atomically through service_role and keeps it draft", async () => {
    await insertVerticals();
    const plan = data().plans[0];
    expect((await adminSeed(plan.id, plan.values)).rows).toEqual([{ added: true }]);
    expect(
      (await db.query("select status,created_by,approved_by from public.target_plans where id=$1", [plan.id])).rows,
    ).toEqual([{ status: "draft", created_by: manager.id, approved_by: null }]);
    expect((await db.query("select id from public.target_allocations where plan_id=$1", [plan.id])).rows).toHaveLength(
      12,
    );
  });
  it("rolls back a failed new snapshot and leaves existing records untouched", async () => {
    const second = data().plans[1];
    await expect(adminSeed(second.id, { ...second.values, created_by: ids.member })).rejects.toThrow(/manager/);
    await expect(
      adminSeed(second.id, {
        ...second.values,
        allocations: [{ quarter: 1, employee_id: ids.outsider, vertical_id: demoFinanceVerticals[0].id, amount: "10" }],
      }),
    ).rejects.toThrow(/active PSE/);
    expect((await db.query("select id from public.target_plans where id=$1", [second.id])).rows).toHaveLength(0);
    expect((await adminSeed(second.id, second.values)).rows).toEqual([{ added: true }]);
  });
  it("preserves edited plans and removed cells on rerun", async () => {
    await asActor(db, ids.manager, tx =>
      tx.query("update public.target_plans set annual_amount=1100000 where id=$1", [demoTargetIds[0]]),
    );
    await db.query("delete from public.target_allocations where plan_id=$1 and quarter=4", [demoTargetIds[0]]);
    expect((await adminSeed(data().plans[0].id, data().plans[0].values)).rows).toEqual([{ added: false }]);
    expect(
      (
        await db.query<{ amount: string }>(
          "select annual_amount::text as amount from public.target_plans where id=$1",
          [demoTargetIds[0]],
        )
      ).rows[0].amount,
    ).toBe("1100000.00");
    expect(
      (await db.query("select id from public.target_allocations where plan_id=$1 and quarter=4", [demoTargetIds[0]]))
        .rows,
    ).toHaveLength(0);
  });
  it("inserts receipts once, verifies Q1 110% and leaves Q2/parents unchanged", async () => {
    const parents = (await db.query("select id,expected_amount,stage_id from public.opportunities order by id")).rows;
    await insertReceipts();
    await insertReceipts();
    expect(
      (await db.query("select id from public.recognized_contributions where id=any($1::uuid[])", [demoContributionIds]))
        .rows,
    ).toHaveLength(6);
    const rows = (
      await asActor(db, ids.member, tx =>
        tx.query<{ actuals: { quarter: number; amount: string }[] }>("select public.target_actuals($1) as actuals", [
          demoTargetIds[0],
        ]),
      )
    ).rows[0].actuals;
    const q1 = rows.filter(a => a.quarter === 1).reduce((sum, a) => sum + cents(a.amount), 0n);
    expect(targetPerformance(cents("150000"), q1).percentage).toBe("110.00");
    expect(
      (
        await db.query<{ amount: string }>(
          "select amount::text from public.target_quarters where plan_id=$1 and quarter=2",
          [demoTargetIds[0]],
        )
      ).rows[0].amount,
    ).toBe("250000.00");
    expect((await db.query("select id,expected_amount,stage_id from public.opportunities order by id")).rows).toEqual(
      parents,
    );
    expect(
      (
        await asActor(db, ids.outsider, tx =>
          tx.query("select id from public.recognized_contributions where id=any($1::uuid[])", [demoContributionIds]),
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("refuses non-reserved IDs and preserves the creator when an existing plan is skipped", async () => {
    await expect(adminSeed(ids.draftPlan, data().plans[0].values)).rejects.toThrow(/Reserved/);
    await expect(
      adminSeed(demoTargetIds[1], { ...data().plans[1].values, created_by: ids.member }),
    ).resolves.toBeTruthy();
  });
});
