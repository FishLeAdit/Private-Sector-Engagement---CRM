import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";

let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});

describe("target approval and fixed allocations in PostgreSQL", () => {
  it("reconciles uneven quarter baselines and one employee/vertical matrix", async () => {
    const { rows } = await db.query(
      "select quarter,amount::text from public.target_quarters where plan_id=$1 order by quarter",
      [ids.approvedPlan],
    );
    expect(rows).toEqual([
      { quarter: 1, amount: "150000.00" },
      { quarter: 2, amount: "250000.00" },
      { quarter: 3, amount: "250000.00" },
      { quarter: 4, amount: "350000.00" },
    ]);
    const total = await db.query("select sum(amount)::text as amount from public.target_allocations where plan_id=$1", [
      ids.approvedPlan,
    ]);
    expect(total.rows).toEqual([{ amount: "1000000.00" }]);
  });
  it("preserves Q1 110% achievement without lowering Q2", async () => {
    const { rows } = await db.query<{
      percentage: string;
    }>(`select round(100*sum(amount)/150000,2)::text as percentage from public.recognized_contributions
      where currency='BDT' and recognized_at >= '2026-01-01Z' and recognized_at < '2026-04-01Z'`);
    expect(rows[0].percentage).toBe("110.00");
    const q2 = await db.query<{ amount: string }>(
      "select amount::text from public.target_quarters where plan_id=$1 and quarter=2",
      [ids.approvedPlan],
    );
    expect(q2.rows[0].amount).toBe("250000.00");
  });
  it("denies member target creation and approval", async () => {
    await expect(
      asActor(db, ids.member, tx => tx.query("insert into public.target_plans(year,annual_amount) values(2030,1000)")),
    ).rejects.toThrow();
    await expect(
      asActor(db, ids.member, tx => tx.query("select public.approve_target_plan($1)", [ids.draftPlan])),
    ).rejects.toThrow(/manager/i);
    const result = await asActor(db, ids.member, tx =>
      tx.query("update public.target_plans set annual_amount=1 where id=$1 returning id", [ids.draftPlan]),
    );
    expect(result.rows).toHaveLength(0);
  });
  it("rejects approval without exactly four reconciled quarters", async () => {
    await expect(
      asActor(db, ids.manager, tx => tx.query("select public.approve_target_plan($1)", [ids.draftPlan])),
    ).rejects.toThrow(/four|quarter/i);
    await expect(
      asActor(db, ids.manager, async tx => {
        await tx.query(
          "insert into public.target_quarters(plan_id,quarter,amount) select $1,n,249999.99 from generate_series(1,4)n",
          [ids.draftPlan],
        );
        return tx.query("select public.approve_target_plan($1)", [ids.draftPlan]);
      }),
    ).rejects.toThrow(/reconcile/i);
  });
  it("rejects quarter allocations that do not reconcile to their baselines", async () => {
    await expect(
      asActor(db, ids.manager, async tx => {
        await tx.query(
          "insert into public.target_quarters(plan_id,quarter,amount) select $1,n,250000 from generate_series(1,4)n",
          [ids.draftPlan],
        );
        return tx.query("select public.approve_target_plan($1)", [ids.draftPlan]);
      }),
    ).rejects.toThrow(/allocations|quarter/i);
  });
  it("cannot bypass reconciliation with a direct approved-status update", async () => {
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query("update public.target_plans set status='approved' where id=$1", [ids.draftPlan]),
      ),
    ).rejects.toThrow(/four|quarter/i);
  });
  it("rejects allocation to inactive/non-PSE employees and duplicate grid cells", async () => {
    for (const employee of [ids.inactive, ids.outsider]) {
      await expect(
        asActor(db, ids.manager, async tx => {
          await tx.query("insert into public.target_quarters(plan_id,quarter,amount) values($1,1,250000)", [
            ids.draftPlan,
          ]);
          return tx.query(
            "insert into public.target_allocations(plan_id,quarter,employee_id,vertical_id,amount) values($1,1,$2,$3,250000)",
            [ids.draftPlan, employee, ids.dsp],
          );
        }),
      ).rejects.toThrow(/active PSE/i);
    }
    await expect(
      asActor(db, ids.manager, async tx => {
        await tx.query("insert into public.target_quarters(plan_id,quarter,amount) values($1,1,250000)", [
          ids.draftPlan,
        ]);
        const sql =
          "insert into public.target_allocations(plan_id,quarter,employee_id,vertical_id,amount) values($1,1,$2,$3,125000)";
        await tx.query(sql, [ids.draftPlan, ids.member, ids.dsp]);
        return tx.query(sql, [ids.draftPlan, ids.member, ids.dsp]);
      }),
    ).rejects.toThrow(/unique|duplicate/i);
  });
  it("approves a complete plan atomically with verified manager identity", async () => {
    await asActor(db, ids.manager, async tx => {
      await tx.query(
        "insert into public.target_quarters(plan_id,quarter,amount) select $1,n,250000 from generate_series(1,4)n",
        [ids.draftPlan],
      );
      await tx.query(
        "insert into public.target_allocations(plan_id,quarter,employee_id,vertical_id,amount) select $1,n,$2,$3,250000 from generate_series(1,4)n",
        [ids.draftPlan, ids.member, ids.dsp],
      );
      await tx.query("select public.approve_target_plan($1)", [ids.draftPlan]);
    });
    const { rows } = await db.query(
      "select status,approved_by,approved_at is not null as stamped from public.target_plans where id=$1",
      [ids.draftPlan],
    );
    expect(rows).toEqual([{ status: "approved", approved_by: ids.manager, stamped: true }]);
  });
  it("prevents changes to approved headers, quarters and allocation cells", async () => {
    // RLS may hide the update target; database triggers still protect owner-level writes.
    const result = await asActor(db, ids.manager, tx =>
      tx.query("update public.target_plans set annual_amount=1 where id=$1 returning id", [ids.approvedPlan]),
    );
    expect(result.rows).toHaveLength(0);
    await expect(
      db.query("update public.target_plans set annual_amount=1 where id=$1", [ids.approvedPlan]),
    ).rejects.toThrow(/immutable/i);
    await expect(
      db.query("update public.target_quarters set amount=1 where plan_id=$1 and quarter=2", [ids.approvedPlan]),
    ).rejects.toThrow(/draft/i);
    await expect(
      db.query("update public.target_allocations set amount=1 where plan_id=$1", [ids.approvedPlan]),
    ).rejects.toThrow(/draft/i);
    await expect(
      asActor(db, ids.manager, tx => tx.query("delete from public.target_plans where id=$1", [ids.approvedPlan])),
    ).rejects.toThrow(/permission/i);
  });
  it("retains immutable approval audit history", async () => {
    const { rows } = await db.query<{ before: { status: string }; after: { status: string } }>(
      "select before,after from public.audit_logs where entity='target_plans' and entity_id=$1 and action='update' and after->>'status'='approved'",
      [ids.approvedPlan],
    );
    expect(rows[0].before.status).toBe("draft");
    expect(rows[0].after.status).toBe("approved");
    await expect(db.exec("update public.audit_logs set action='hidden'")).rejects.toThrow(/immutable/i);
  });
});
