import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import { correctionSchema } from "../../src/features/contributions/schemas";
import { remainingAmount } from "../../src/features/contributions/service";
import type { Report } from "../../src/features/reports/types";
import { cents, money, signedCents } from "../../src/lib/money";
vi.mock("server-only", () => ({}));
let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});
let serial = 0;
const uuid = () => `e2000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`;
// Each receipt gets its own year so report totals stay independent between tests.
const receipt = (year: number, amount = "100.00") => ({
  opportunity_id: ids.cashOpportunity,
  employee_id: ids.member,
  target_vertical_id: ids.dsp,
  amount,
  currency: "BDT",
  recognized_at: `${year}-05-10T04:00:00Z`,
  contribution_type: "cash",
  approved_value_note: null,
  valuation_reference_url: null,
  notes: "Fictional received contribution",
});
const record = async (values: unknown, actor: string = ids.member) => {
  const id = uuid();
  await asActor(db, actor, tx =>
    tx.query("select public.record_contribution($1,$2::jsonb)", [id, JSON.stringify(values)]),
  );
  return id;
};
const correct = (
  original: string,
  amount: string,
  reason = "Fictional refund",
  id = uuid(),
  actor: string | null = ids.manager,
) =>
  asActor(db, actor, tx =>
    tx.query("select public.correct_contribution($1,$2,$3,$4)", [id, original, amount, reason]),
  ).then(() => id);
const row = (id: string) =>
  db
    .query<Record<string, unknown>>(
      "select amount::text,employee_id,target_vertical_id,recognized_at,recorded_by,corrects_contribution_id,correction_reason,notes from public.recognized_contributions where id=$1",
      [id],
    )
    .then(result => result.rows[0]);
const report = (year: number) =>
  asActor(
    db,
    ids.member,
    async tx =>
      (await tx.query<{ data: Report }>("select public.pse_report($1,0,0,'','','BDT') as data", [year])).rows[0].data,
  );

describe("signed amounts and correction input", () => {
  it("reads stored negative amounts but keeps user input non-negative", () => {
    expect(signedCents("-12.5")).toBe(-1250n);
    expect(signedCents(-0.5)).toBe(-50n);
    expect(money("-1500.5", "BDT")).toBe("BDT -1,500.50");
    expect(() => cents("-1")).toThrow();
    expect(() => signedCents("--1")).toThrow();
  });
  it("nets a receipt against its corrections", () => {
    expect(remainingAmount("100.00", [{ amount: "-30" }, { amount: -20.5 }])).toBe(4950n);
  });
  it.each([
    ["a zero amount", { amount: "0" }],
    ["a negative amount", { amount: "-5" }],
    ["fractional cents", { amount: "1.001" }],
    ["a blank reason", { reason: "   " }],
    ["a reason over 2,000 characters", { reason: "x".repeat(2001) }],
    ["an unknown field", { employee_id: ids.colleague }],
  ])("rejects %s", (_, extra) => {
    expect(correctionSchema.safeParse({ request_id: uuid(), amount: "5", reason: "Refund", ...extra }).success).toBe(
      false,
    );
  });
});

describe("manager-only contribution corrections", () => {
  it("adds a negative entry that inherits the receipt's attribution and never edits the receipt", async () => {
    const original = await record(receipt(2041));
    const id = await correct(original, "40", "  Fictional partial refund  ");
    expect(await row(id)).toMatchObject({
      amount: "-40.00",
      employee_id: ids.member,
      target_vertical_id: ids.dsp,
      recorded_by: ids.manager,
      corrects_contribution_id: original,
      correction_reason: "Fictional partial refund",
      notes: null,
    });
    expect((await row(id)).recognized_at).toEqual((await row(original)).recognized_at);
    expect((await row(original)).amount).toBe("100.00");
  });
  it("is idempotent for a retried submission and conflicts when the ID is reused", async () => {
    const original = await record(receipt(2042));
    const id = await correct(original, "10");
    await correct(original, "10", "Fictional refund", id);
    expect(
      (await db.query("select id from public.recognized_contributions where corrects_contribution_id=$1", [original]))
        .rows,
    ).toHaveLength(1);
    await expect(correct(original, "11", "Fictional refund", id)).rejects.toMatchObject({ code: "23505" });
  });
  it.each([ids.member, ids.outsider, ids.inactive, null])("denies a correction by %s", async actor => {
    const original = await record(receipt(2043));
    await expect(correct(original, "1", "Fictional refund", uuid(), actor)).rejects.toThrow();
  });
  it("blocks a member's direct insert of a negative entry", async () => {
    const original = await record(receipt(2044));
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.recognized_contributions(opportunity_id,employee_id,amount,recognized_at,contribution_type,corrects_contribution_id,correction_reason) values($1,$2,-1,'2044-05-10T04:00:00Z','cash',$3,'x')",
          [ids.cashOpportunity, ids.member, original],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("never takes a receipt below zero and allows a full reversal", async () => {
    const original = await record(receipt(2045));
    await correct(original, "60");
    await expect(correct(original, "40.01")).rejects.toMatchObject({ code: "23514" });
    await correct(original, "40");
    await expect(correct(original, "0.01")).rejects.toMatchObject({ code: "23514" });
  });
  it("refuses to correct a correction, or to change a correction's attribution", async () => {
    const original = await record(receipt(2046));
    const id = await correct(original, "5");
    await expect(correct(id, "1")).rejects.toThrow(/cannot itself be corrected/);
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query(
          "insert into public.recognized_contributions(opportunity_id,employee_id,amount,recognized_at,contribution_type,recorded_by,corrects_contribution_id,correction_reason) values($1,$2,-1,'2046-05-10T04:00:00Z','cash',$3,$4,'Fictional')",
          [ids.cashOpportunity, ids.colleague, ids.manager, original],
        ),
      ),
    ).rejects.toThrow(/attribution and recognition time/);
  });
  it("keeps the receipt rules: positive receipts only, reasons only on corrections, no edits", async () => {
    const original = await record(receipt(2047));
    await expect(record({ ...receipt(2047), amount: "-1" })).rejects.toThrow();
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.recognized_contributions(opportunity_id,employee_id,amount,recognized_at,contribution_type,correction_reason) values($1,$2,1,'2047-05-10Z','cash','x')",
          [ids.cashOpportunity, ids.member],
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query("update public.recognized_contributions set amount=1 where id=$1", [original]),
      ),
    ).rejects.toThrow();
  });
  it("stays possible after the deal closes as lost", async () => {
    const usd = {
      ...receipt(2048),
      opportunity_id: ids.usdOpportunity,
      currency: "USD",
      target_vertical_id: null,
    };
    const original = await record(usd);
    const lost = (await db.query<{ id: string }>("select id from public.pipeline_stages where name='Lost'")).rows[0].id;
    await asActor(db, ids.manager, tx =>
      tx.query("update public.opportunities set stage_id=$1 where id=$2", [lost, ids.usdOpportunity]),
    );
    expect((await row(await correct(original, "100"))).amount).toBe("-100.00");
  });
  it("nets report totals, quarters, months and cells while counting only receipts", async () => {
    const original = await record(receipt(2049, "250"));
    await record(receipt(2049, "50"));
    await correct(original, "100");
    const r = await report(2049);
    expect(r.fundraising).toMatchObject({ actual: "200.00", receipt_count: 2 });
    expect(r.trends[4].actual).toBe("200.00");
    expect(r.fundraising.types.find(t => t.key === "cash")).toMatchObject({ amount: "200.00", count: 2 });
    expect(r.fundraising.dimensions.find(d => d.employee_id === ids.member && d.vertical_id === ids.dsp)).toMatchObject(
      { actual: "200.00", receipt_count: 2 },
    );
  });
});
