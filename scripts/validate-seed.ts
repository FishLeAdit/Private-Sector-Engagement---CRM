import assert from "node:assert/strict";
import { asActor, createLocalDatabase, fixtureIds as ids } from "./lib/local-database";

async function main() {
  const db = await createLocalDatabase();
  try {
    const { rows: tables } = await db.query<{ name: string; rls: boolean }>(`
      select c.relname as name, c.relrowsecurity as rls from pg_class c
      join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'`);
    assert.equal(tables.length, 13);
    assert.ok(
      tables.every(table => table.rls),
      "Every CRM table must enable RLS",
    );
    const { rows: totals } = await db.query<{ currency: string; amount: string }>(`
      select currency,sum(amount)::text as amount from public.recognized_contributions group by currency order by currency`);
    assert.deepEqual(totals, [
      { currency: "BDT", amount: "205000.00" },
      { currency: "USD", amount: "200.00" },
    ]);
    const { rows: quarters } = await db.query<{ quarter: number; target: string; allocated: string }>(
      `
      select q.quarter,q.amount::text as target,sum(a.amount)::text as allocated from public.target_quarters q
      join public.target_allocations a using(plan_id,quarter) where q.plan_id=$1 group by q.quarter,q.amount order by q.quarter`,
      [ids.approvedPlan],
    );
    assert.equal(quarters.length, 4);
    assert.ok(quarters.every(q => q.target === q.allocated));
    assert.equal(quarters[1].target, "250000.00");
    const { rows: q1 } = await db.query<{ percent: string }>(`select round(100*sum(amount)/150000,2)::text as percent
      from public.recognized_contributions where currency='BDT' and recognized_at >= '2026-01-01Z' and recognized_at < '2026-04-01Z'`);
    assert.equal(q1[0].percent, "110.00");
    const { rows: unlinked } = await db.query<{ count: number }>(`select count(*)::int as count from public.activities
      where contact_id is null and opportunity_id is null and meeting_id is null`);
    assert.equal(unlinked[0].count, 2);
    for (const actor of [ids.outsider, ids.inactive]) {
      const rows = await asActor(db, actor, async tx => (await tx.query("select id from public.contacts")).rows);
      assert.equal(rows.length, 0);
    }
    const visible = await asActor(db, ids.member, async tx => (await tx.query("select id from public.contacts")).rows);
    assert.equal(visible.length, 4);
    console.log(
      "Validated: 13 migrated tables with RLS; fictional seed; reconciled 1,000,000 BDT target; Q1 110%; Q2 unchanged; realized totals grouped by currency; independent activities; basic role visibility.",
    );
    console.log(
      "Local PostgreSQL/Auth-adapter verification only. No hosted Supabase project or login flow was tested.",
    );
  } finally {
    await db.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
