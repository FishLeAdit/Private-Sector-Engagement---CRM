import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
let db: PGlite;
beforeAll(async () => { db = await createLocalDatabase(); });
afterAll(async () => { await db?.close(); });
async function meeting(owner: string = ids.member, actor: string = ids.member, status = "scheduled") {
  return (await asActor(db, actor, tx => tx.query<{ id: string }>("insert into public.meetings(title,contact_id,opportunity_id,scheduled_at,owner_id,status) values('Fictional delete meeting',$1,$2,now(),$3,$4) returning id", [ids.person,ids.cashOpportunity,owner,status]))).rows[0].id;
}
const remove = (id: string, actor: string | null = ids.member) => asActor(db, actor, tx => tx.query("delete from public.meetings where id=$1 returning id", [id]));
describe("meeting DELETE RLS and retained relationships", () => {
  it("deletes as owner and retains the actor/before audit and parent records", async () => {
    const id = await meeting(); expect((await remove(id)).rows).toEqual([{ id }]);
    const audit = (await asActor(db, ids.colleague, tx => tx.query<{ actor_id: string; before: { id: string }; after: null }>("select actor_id,before,after from public.audit_logs where entity='meetings' and entity_id=$1 and action='delete'", [id]))).rows;
    expect(audit).toHaveLength(1); expect(audit[0]).toMatchObject({ actor_id: ids.member, before: { id }, after: null });
    expect((await db.query("select id from public.contacts where id=$1", [ids.person])).rows).toHaveLength(1); expect((await db.query("select id from public.opportunities where id=$1", [ids.cashOpportunity])).rows).toHaveLength(1);
  });
  it("permits manager deletion and a distinct owner", async () => { const own = await meeting(); expect((await remove(own,ids.manager)).rows).toHaveLength(1); const assigned = await meeting(ids.colleague,ids.manager); expect((await remove(assigned,ids.colleague)).rows).toHaveLength(1); });
  it("permits the creator after ownership reassignment", async () => {
    const id = await meeting(); await asActor(db, ids.manager, tx => tx.query("update public.meetings set owner_id=$1 where id=$2", [ids.colleague,id])); expect((await remove(id)).rows).toHaveLength(1);
  });
  it.each([ids.colleague,ids.outsider,ids.inactive])("denies unrelated or restricted actor %s", async actor => {
    const id = await meeting(); expect((await remove(id,actor)).rows).toEqual([]); expect((await db.query("select id from public.meetings where id=$1", [id])).rows).toHaveLength(1);
  });
  it("denies anonymous deletion", async () => { await expect(remove(await meeting(), null)).rejects.toThrow(/permission/i); });
  it.each(["inactive", "non-PSE"])("revokes an %s owner's deletion access", async restriction => {
    const id = await meeting(); await db.query("update public.profiles set active=$1,department=$2 where id=$3", [restriction !== "inactive",restriction === "non-PSE" ? "HR" : "PSE",ids.member]);
    try { expect((await remove(id)).rows).toEqual([]); } finally { await db.query("update public.profiles set active=true,department='PSE' where id=$1", [ids.member]); }
  });
  it.each(["task", "call"])("protects linked %s activities with no cascade or failed-delete audit", async activityType => {
    const id = await meeting(); await asActor(db, ids.member, tx => tx.query("insert into public.activities(activity_type,owner_id,meeting_id,contact_id,opportunity_id,notes) values($1,$2,$3,$4,$5,'Fictional linked work')", [activityType,ids.member,id,ids.person,ids.cashOpportunity]));
    for (const actor of [ids.member,ids.manager]) await expect(remove(id,actor)).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
    expect((await db.query("select id from public.meetings where id=$1", [id])).rows).toHaveLength(1); expect((await db.query("select id from public.activities where meeting_id=$1", [id])).rows).toHaveLength(1);
    expect((await db.query("select id from public.audit_logs where entity='meetings' and entity_id=$1 and action='delete'", [id])).rows).toHaveLength(0);
  });
  it.each(["done", "cancelled"])("allows deletion in status %s without changing actual achievement", async status => {
    const before = (await db.query("select id,amount from public.recognized_contributions order by id")).rows; expect((await remove(await meeting(ids.member,ids.member,status))).rows).toHaveLength(1); expect((await db.query("select id,amount from public.recognized_contributions order by id")).rows).toEqual(before);
  });
});
