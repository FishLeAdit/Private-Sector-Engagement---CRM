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
async function createDeal(owner: string = ids.member, creator: string = ids.member) {
  const result = await asActor(db, creator, tx =>
    tx.query<{ id: string }>(
      `insert into public.opportunities(deal_name,contact_id,primary_contact_id,secondary_contact_id,owner_id,stage_id,contribution_type,contribution_category_id,expected_amount)
    values('Fictional deletion deal',$1,$2,$3,$4,'70000000-0000-4000-8000-000000000001','cash','80000000-0000-4000-8000-000000000001',1000) returning id`,
      [ids.company, ids.person, ids.secondary, owner],
    ),
  );
  return result.rows[0].id;
}
const remove = (id: string, actor: string | null = ids.member) =>
  asActor(db, actor, tx => tx.query("delete from public.opportunities where id=$1 returning id", [id]));
describe("opportunity deletion RLS, foreign keys and audit history", () => {
  it("allows deletion and retains the actor/snapshot while preserving contacts", async () => {
    const id = await createDeal();
    expect((await remove(id)).rows).toEqual([{ id }]);
    const audit = (
      await asActor(db, ids.colleague, tx =>
        tx.query<{ actor_id: string; before: { id: string; expected_amount: number }; after: null }>(
          "select actor_id,before,after from public.audit_logs where entity='opportunities' and entity_id=$1 and action='delete'",
          [id],
        ),
      )
    ).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].actor_id).toBe(ids.member);
    expect(audit[0].before).toMatchObject({ id, expected_amount: 1000 });
    expect(audit[0].after).toBeNull();
    expect(
      (
        await db.query("select id from public.contacts where id=any($1::uuid[])", [
          [ids.company, ids.person, ids.secondary],
        ])
      ).rows,
    ).toHaveLength(3);
  });
  it("permits managers to delete colleagues' unlinked opportunities", async () => {
    const id = await createDeal();
    expect((await remove(id, ids.manager)).rows).toEqual([{ id }]);
  });
  it("permits a focal person distinct from the creator", async () => {
    const id = await createDeal(ids.colleague, ids.manager);
    expect((await remove(id, ids.colleague)).rows).toEqual([{ id }]);
  });
  it("permits the creator after a manager reassigns ownership", async () => {
    const id = await createDeal();
    await asActor(db, ids.manager, tx =>
      tx.query("update public.opportunities set owner_id=$1 where id=$2", [ids.colleague, id]),
    );
    expect((await remove(id, ids.member)).rows).toEqual([{ id }]);
  });
  it.each([ids.colleague, ids.outsider, ids.inactive])("denies unrelated/restricted actor %s", async actor => {
    const id = await createDeal();
    expect((await remove(id, actor)).rows).toEqual([]);
    expect((await db.query("select id from public.opportunities where id=$1", [id])).rows).toHaveLength(1);
  });
  it("denies anonymous deletion", async () => {
    await expect(remove(await createDeal(), null)).rejects.toThrow(/permission/i);
  });
  it.each(["inactive", "non-PSE"])("denies an %s focal person/creator on their own deal", async restriction => {
    const id = await createDeal();
    await db.query("update public.profiles set active=$1,department=$2 where id=$3", [
      restriction !== "inactive",
      restriction === "non-PSE" ? "HR" : "PSE",
      ids.member,
    ]);
    try {
      expect((await remove(id)).rows).toEqual([]);
    } finally {
      await db.query("update public.profiles set active=true,department='PSE' where id=$1", [ids.member]);
    }
  });
  it.each(["meeting", "activity", "contribution"])(
    "blocks deletion referenced by a %s with no cascade or delete audit",
    async reference => {
      const id = await createDeal();
      await asActor(db, ids.member, tx =>
        reference === "meeting"
          ? tx.query(
              "insert into public.meetings(opportunity_id,title,scheduled_at,owner_id) values($1,'Fictional linked meeting',now(),$2)",
              [id, ids.member],
            )
          : reference === "activity"
            ? tx.query("insert into public.activities(activity_type,owner_id,opportunity_id) values('call',$1,$2)", [
                ids.member,
                id,
              ])
            : tx.query(
                "insert into public.recognized_contributions(opportunity_id,employee_id,amount,currency,recognized_at,contribution_type) values($1,$2,50,'BDT',now(),'cash')",
                [id, ids.member],
              ),
      );
      await expect(remove(id)).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
      await expect(remove(id, ids.manager)).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
      expect((await db.query("select id from public.opportunities where id=$1", [id])).rows).toHaveLength(1);
      expect(
        (
          await db.query(
            "select id from public.audit_logs where entity='opportunities' and entity_id=$1 and action='delete'",
            [id],
          )
        ).rows,
      ).toEqual([]);
      const table =
        reference === "meeting" ? "meetings" : reference === "activity" ? "activities" : "recognized_contributions";
      expect((await db.query(`select id from public.${table} where opportunity_id=$1`, [id])).rows).toHaveLength(1);
    },
  );
  it("can delete an unlinked Won deal without affecting actual achievement", async () => {
    const before = (await db.query("select count(*)::int as count from public.recognized_contributions")).rows;
    const id = await createDeal();
    await asActor(db, ids.member, tx =>
      tx.query("update public.opportunities set stage_id='70000000-0000-4000-8000-000000000006' where id=$1", [id]),
    );
    expect((await remove(id)).rows).toEqual([{ id }]);
    expect((await db.query("select count(*)::int as count from public.recognized_contributions")).rows).toEqual(before);
  });
});
