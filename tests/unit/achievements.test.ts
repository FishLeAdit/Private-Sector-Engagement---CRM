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

describe("financial integrity in PostgreSQL", () => {
  it("keeps forecast, operational budget and realized funding separate", async () => {
    const { rows } = await db.query(
      `select o.expected_amount::text, o.operational_budget::text, sum(r.amount)::text as realized
      from public.opportunities o join public.recognized_contributions r on r.opportunity_id=o.id where o.id=$1 group by o.id`,
      [ids.cashOpportunity],
    );
    expect(rows).toEqual([{ expected_amount: "500000.00", operational_budget: "12000.00", realized: "165000.00" }]);
  });
  it("groups realized contributions by currency without inventing conversion", async () => {
    const { rows } = await db.query(
      "select currency,sum(amount)::text as amount from public.recognized_contributions group by currency order by currency",
    );
    expect(rows).toEqual([
      { currency: "BDT", amount: "205000.00" },
      { currency: "USD", amount: "200.00" },
    ]);
  });
  it("does not count unvalued activity recognition estimates as financial achievement", async () => {
    await asActor(db, ids.member, tx =>
      tx.query(
        `insert into public.activities(activity_type,owner_id,estimated_nonmonetary_value,notes,related_organization_name)
      values('general',$1,9999,'Fictional unvalued gift','Fictional school')`,
        [ids.member],
      ),
    );
    const { rows } = await db.query(
      "select sum(amount)::text as total from public.recognized_contributions where currency='BDT'",
    );
    expect(rows).toEqual([{ total: "205000.00" }]);
  });
  it.each(["0", "-1", "NaN", "Infinity"])("rejects invalid expected amount %s", async amount => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query("update public.opportunities set expected_amount=$1::numeric where id=$2", [
          amount,
          ids.cashOpportunity,
        ]),
      ),
    ).rejects.toThrow();
  });
  it("requires manual valuation notes for significant in-kind opportunities", async () => {
    await expect(
      asActor(db, ids.colleague, tx =>
        tx.query("update public.opportunities set valuation_note=' ' where id=$1", [ids.inKindOpportunity]),
      ),
    ).rejects.toThrow();
  });
  it("rejects recognized currency/type mismatches and missing in-kind valuation notes", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          `insert into public.recognized_contributions(opportunity_id,employee_id,amount,currency,recognized_at,contribution_type)
      values($1,$2,10,'USD',now(),'cash')`,
          [ids.cashOpportunity, ids.member],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asActor(db, ids.colleague, tx =>
        tx.query(
          `insert into public.recognized_contributions(opportunity_id,employee_id,amount,currency,recognized_at,contribution_type)
      values($1,$2,10,'BDT',now(),'valued_in_kind')`,
          [ids.inKindOpportunity, ids.colleague],
        ),
      ),
    ).rejects.toThrow();
  });
  it("preserves valuation evidence and explicit employee/vertical attribution", async () => {
    const { rows } = await db.query<{
      employee_id: string;
      approved_value_note: string;
      valuation_reference_url: string;
    }>(
      "select employee_id,approved_value_note,valuation_reference_url from public.recognized_contributions where opportunity_id=$1",
      [ids.inKindOpportunity],
    );
    expect(rows[0].employee_id).toBe(ids.colleague);
    expect(rows[0].approved_value_note).toContain("operational team");
    expect(rows[0].valuation_reference_url).toContain("drive.google.com");
  });
  it("prevents clients from editing/deleting realized contributions or forging recorder identity", async () => {
    await expect(
      asActor(db, ids.manager, tx => tx.query("update public.recognized_contributions set amount=1")),
    ).rejects.toThrow(/permission/i);
    await expect(
      asActor(db, ids.manager, tx => tx.query("delete from public.recognized_contributions")),
    ).rejects.toThrow(/permission/i);
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          `insert into public.recognized_contributions(opportunity_id,employee_id,amount,recognized_at,contribution_type,recorded_by)
      values($1,$2,10,now(),'cash',$3)`,
          [ids.cashOpportunity, ids.member, ids.manager],
        ),
      ),
    ).rejects.toThrow();
  });
  it("keeps contribution attribution stable if the opportunity is reassigned", async () => {
    await asActor(db, ids.manager, tx =>
      tx.query("update public.opportunities set owner_id=$1 where id=$2", [ids.colleague, ids.cashOpportunity]),
    );
    const { rows } = await db.query("select employee_id from public.recognized_contributions where opportunity_id=$1", [
      ids.cashOpportunity,
    ]);
    expect(rows).toEqual([{ employee_id: ids.member }]);
  });
  it("prevents changing an opportunity currency underneath recognized contributions", async () => {
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query("update public.opportunities set currency='USD' where id=$1", [ids.cashOpportunity]),
      ),
    ).rejects.toThrow();
  });
});
