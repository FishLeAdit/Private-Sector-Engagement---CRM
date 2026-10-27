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

async function createContact(suffix: string, kind = "individual") {
  const result = await asActor(db, ids.member, tx =>
    tx.query<{ id: string }>("insert into public.contacts(kind,name,email) values($1,$2,$3) returning id", [
      kind,
      `Fictional delete ${suffix}`,
      `delete-${suffix}@example.invalid`,
    ]),
  );
  return result.rows[0].id;
}

describe("contact DELETE RLS, references and audit history", () => {
  it("allows the creator to delete and retains the actor/before snapshot", async () => {
    const id = await createContact("creator");
    expect(
      (await asActor(db, ids.member, tx => tx.query("delete from public.contacts where id=$1 returning id", [id])))
        .rows,
    ).toEqual([{ id }]);
    const { rows } = await asActor(db, ids.member, tx =>
      tx.query<{ actor_id: string; before: { id: string }; after: null }>(
        "select actor_id,before,after from public.audit_logs where entity='contacts' and entity_id=$1 and action='delete'",
        [id],
      ),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].actor_id).toBe(ids.member);
    expect(rows[0].before.id).toBe(id);
    expect(rows[0].after).toBeNull();
  });
  it("permits an authorized manager to delete another creator's unlinked record", async () => {
    const id = await createContact("manager");
    expect(
      (await asActor(db, ids.manager, tx => tx.query("delete from public.contacts where id=$1 returning id", [id])))
        .rows,
    ).toEqual([{ id }]);
  });
  it.each([ids.colleague, ids.outsider, ids.inactive])(
    "denies direct SQL deletion to restricted actor %s",
    async actor => {
      const id = await createContact(actor.slice(-4));
      expect(
        (await asActor(db, actor, tx => tx.query("delete from public.contacts where id=$1 returning id", [id]))).rows,
      ).toHaveLength(0);
      expect((await db.query("select id from public.contacts where id=$1", [id])).rows).toHaveLength(1);
    },
  );
  it("denies anonymous deletion even if the ID is known", async () => {
    const id = await createContact("anon");
    await expect(asActor(db, null, tx => tx.query("delete from public.contacts where id=$1", [id]))).rejects.toThrow(
      /permission/i,
    );
  });
  it.each(["inactive", "other-department"])("denies an %s creator even on their own contact", async restriction => {
    const id = await createContact(restriction);
    await db.query("update public.profiles set active=$1,department=$2 where id=$3", [
      restriction !== "inactive",
      restriction === "other-department" ? "HR" : "PSE",
      ids.member,
    ]);
    try {
      expect(
        (await asActor(db, ids.member, tx => tx.query("delete from public.contacts where id=$1 returning id", [id])))
          .rows,
      ).toHaveLength(0);
      expect((await db.query("select id from public.contacts where id=$1", [id])).rows).toHaveLength(1);
    } finally {
      await db.query("update public.profiles set active=true,department='PSE' where id=$1", [ids.member]);
    }
  });
  it.each(["company", "opportunity", "primary", "secondary", "meeting", "activity"] as const)(
    "preserves a contact referenced by %s",
    async reference => {
      const id = await createContact(reference, reference === "company" ? "company" : "individual");
      await asActor(db, ids.member, async tx => {
        if (reference === "company") {
          await tx.query(
            "insert into public.contacts(kind,name,email,company_id) values('individual','Fictional linked employee','delete-linked-employee@example.invalid',$1)",
            [id],
          );
        } else if (["opportunity", "primary", "secondary"].includes(reference)) {
          await tx.query(
            `insert into public.opportunities(deal_name,contact_id,primary_contact_id,secondary_contact_id,owner_id,stage_id,contribution_type,contribution_category_id,expected_amount)
          values($1,$2,$3,$4,$5,'70000000-0000-4000-8000-000000000001','cash','80000000-0000-4000-8000-000000000001',1000)`,
            [
              `Fictional delete guard ${reference}`,
              reference === "opportunity" ? id : ids.company,
              reference === "primary" ? id : reference === "secondary" ? ids.person : null,
              reference === "secondary" ? id : null,
              ids.member,
            ],
          );
        } else if (reference === "meeting") {
          await tx.query(
            "insert into public.meetings(title,contact_id,scheduled_at,owner_id) values('Fictional linked meeting',$1,now(),$2)",
            [id, ids.member],
          );
        } else {
          await tx.query("insert into public.activities(activity_type,contact_id,owner_id) values('call',$1,$2)", [
            id,
            ids.member,
          ]);
        }
      });
      await expect(
        asActor(db, ids.member, tx => tx.query("delete from public.contacts where id=$1", [id])),
      ).rejects.toMatchObject({ code: expect.stringMatching(/^(23503|23001)$/) });
      expect((await db.query("select id from public.contacts where id=$1", [id])).rows).toHaveLength(1);
      expect(
        (
          await db.query(
            "select id from public.audit_logs where entity='contacts' and entity_id=$1 and action='delete'",
            [id],
          )
        ).rows,
      ).toHaveLength(0);
    },
  );
});
