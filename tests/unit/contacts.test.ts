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

describe("contact constraints and CRM access in PostgreSQL", () => {
  it("allows an individual without a company and with phone only", async () => {
    const result = await asActor(db, ids.member, tx =>
      tx.query(`insert into public.contacts(kind,name,phone)
      values('individual','Fictional Phone Only','+880 1700 009001') returning company_id,email,phone_normalized`),
    );
    expect(result.rows).toEqual([{ company_id: null, email: null, phone_normalized: "8801700009001" }]);
  });
  it("requires an actual email or phone value", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query("insert into public.contacts(kind,name,email,phone) values('individual','Invalid','  ',' - ')"),
      ),
    ).rejects.toThrow();
  });
  it("rejects duplicate normalized email", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.contacts(kind,name,email) values('individual','Duplicate',' ONE@EXAMPLE.INVALID ')",
        ),
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
  it("rejects duplicate normalized phone", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query("insert into public.contacts(kind,name,phone) values('individual','Duplicate','+880 (1700)-000004')"),
      ),
    ).rejects.toThrow(/unique|duplicate/i);
  });
  it("rejects non-HTTP URLs and individual-as-company links", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.contacts(kind,name,email,website) values('company','Invalid','bad-url@example.invalid','javascript:alert(1)')",
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.contacts(kind,name,email,company_id) values('individual','Invalid','bad-link@example.invalid',$1)",
          [ids.person],
        ),
      ),
    ).rejects.toThrow();
  });
  it("prevents changing a contact kind underneath linked records", async () => {
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query("update public.contacts set kind='individual' where id=$1", [ids.company]),
      ),
    ).rejects.toThrow(/kind/i);
  });
  it("allows PSE members to read colleagues' activities", async () => {
    const result = await asActor(db, ids.member, tx =>
      tx.query("select id from public.activities where owner_id=$1", [ids.colleague]),
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });
  it.each([ids.outsider, ids.inactive])("denies all CRM table reads to restricted user %s", async actor => {
    const tables = (
      await db.query<{ name: string }>("select tablename as name from pg_tables where schemaname='public'")
    ).rows;
    for (const table of tables) {
      const result = await asActor(db, actor, tx => tx.query(`select * from public.${table.name}`));
      expect(result.rows).toHaveLength(0);
    }
    await expect(
      asActor(db, actor, tx =>
        tx.query(
          "insert into public.contacts(kind,name,email) values('individual','Blocked','blocked@example.invalid')",
        ),
      ),
    ).rejects.toThrow();
  });
  it("denies anonymous table access and RPC execution", async () => {
    await expect(asActor(db, null, tx => tx.query("select * from public.contacts"))).rejects.toThrow(/permission/i);
    await expect(
      asActor(db, null, tx => tx.query("select public.approve_target_plan($1)", [ids.draftPlan])),
    ).rejects.toThrow(/permission/i);
  });
  it("prevents profile escalation, creator spoofing and direct audit insertion", async () => {
    await expect(
      asActor(db, ids.member, tx => tx.query("update public.profiles set role='admin' where id=$1", [ids.member])),
    ).rejects.toThrow(/permission/i);
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          "insert into public.contacts(kind,name,email,created_by) values('individual','Spoofed','spoofed@example.invalid',$1)",
          [ids.manager],
        ),
      ),
    ).rejects.toThrow();
    await expect(
      asActor(db, ids.member, tx =>
        tx.query("insert into public.audit_logs(entity,entity_id,action) values('contacts',$1,'forged')", [
          ids.company,
        ]),
      ),
    ).rejects.toThrow(/permission/i);
  });
  it("limits operational updates to owner/creator or manager", async () => {
    const result = await asActor(db, ids.member, tx =>
      tx.query("update public.contacts set notes='unauthorized' where id=$1 returning id", [ids.company]),
    );
    expect(result.rows).toHaveLength(0);
  });
  it("retains independent activity context and remaining work", async () => {
    const result = await asActor(db, ids.member, tx =>
      tx.query(
        `insert into public.activities(activity_type,owner_id,related_person_name,related_organization_name,remaining_work)
      values('general',$1,'Fictional Visitor','Fictional Organization','Reply to request') returning contact_id,opportunity_id,meeting_id,remaining_work`,
        [ids.member],
      ),
    );
    expect(result.rows).toEqual([
      { contact_id: null, opportunity_id: null, meeting_id: null, remaining_work: "Reply to request" },
    ]);
  });
  it("accepts a company opportunity's designated individual as meeting point of contact", async () => {
    const result = await asActor(db, ids.member, tx =>
      tx.query(
        `insert into public.meetings(contact_id,opportunity_id,title,scheduled_at,owner_id)
      values($1,$2,'Fictional individual POC meeting',now(),$3) returning id`,
        [ids.person, ids.cashOpportunity, ids.member],
      ),
    );
    expect(result.rows).toHaveLength(1);
  });
  it("blocks removal of a contact point used by an existing activity", async () => {
    await asActor(db, ids.colleague, tx =>
      tx.query(
        `insert into public.activities(activity_type,owner_id,contact_id,opportunity_id)
      values('call',$1,$2,$3)`,
        [ids.colleague, ids.secondary, ids.cashOpportunity],
      ),
    );
    await expect(
      asActor(db, ids.manager, tx =>
        tx.query("update public.opportunities set secondary_contact_id=null where id=$1", [ids.cashOpportunity]),
      ),
    ).rejects.toThrow();
  });
  it("rejects contradictory activity and meeting links", async () => {
    await expect(
      asActor(db, ids.member, tx =>
        tx.query(
          `insert into public.activities(activity_type,owner_id,contact_id,meeting_id)
      values('call',$1,$2,$3)`,
          [ids.member, ids.individual, ids.meeting],
        ),
      ),
    ).rejects.toThrow();
  });
  it("records actor and before/after values on edits", async () => {
    await asActor(db, ids.manager, tx =>
      tx.query("update public.contacts set notes='Fictional audited change' where id=$1", [ids.company]),
    );
    const { rows } = await asActor(db, ids.member, tx =>
      tx.query<{ actor_id: string; before: { notes: string }; after: { notes: string } }>(
        "select actor_id,before,after from public.audit_logs where entity='contacts' and entity_id=$1 and action='update' order by created_at desc limit 1",
        [ids.company],
      ),
    );
    expect(rows[0].actor_id).toBe(ids.manager);
    expect(rows[0].before.notes).not.toBe(rows[0].after.notes);
    expect(rows[0].after.notes).toBe("Fictional audited change");
  });
  it("hides other-department profile audit history from PSE readers", async () => {
    await db.query("update public.profiles set display_name='Fictional HR private profile' where id=$1", [
      ids.outsider,
    ]);
    const result = await asActor(db, ids.manager, tx =>
      tx.query("select id from public.audit_logs where entity='profiles' and entity_id=$1", [ids.outsider]),
    );
    expect(result.rows).toHaveLength(0);
  });
  it("allows historical edits after an owner is deactivated", async () => {
    await db.query("update public.profiles set active=false where id=$1", [ids.colleague]);
    try {
      const result = await asActor(db, ids.manager, tx =>
        tx.query("update public.opportunities set notes='Fictional historical note' where id=$1 returning id", [
          ids.inKindOpportunity,
        ]),
      );
      expect(result.rows).toHaveLength(1);
    } finally {
      await db.query("update public.profiles set active=true where id=$1", [ids.colleague]);
    }
  });
  it("enables RLS for every CRM table and fixes definer search paths", async () => {
    const { rows } = await db.query<{ enabled: boolean }>(
      "select bool_and(rowsecurity) as enabled from pg_tables where schemaname='public'",
    );
    expect(rows[0].enabled).toBe(true);
    const definers = await db.query<{
      proconfig: string[];
    }>(`select p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('public','private') and p.prosecdef`);
    expect(definers.rows.length).toBeGreaterThan(0);
    expect(definers.rows.every(fn => fn.proconfig.includes('search_path=""'))).toBe(true);
  });
});
