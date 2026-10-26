import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";

let db: PGlite;
beforeAll(async () => { db = await createLocalDatabase(); });
afterAll(async () => { await db?.close(); });

type MeetingValues = { contact: string | null; opportunity: string | null; owner: string; scheduledAt: string; status: string };
async function meeting(values: Partial<MeetingValues> = {}, actor: string = ids.member) {
  const input: MeetingValues = { contact: ids.individual, opportunity: null, owner: actor, scheduledAt: "2026-11-03T10:15:00+06:00", status: "scheduled", ...values };
  const result = await asActor(db, actor, tx => tx.query<{ id: string }>(`insert into public.meetings
    (contact_id,opportunity_id,title,scheduled_at,status,description,owner_id)
    values($1,$2,'Fictional meeting integrity test',$3,$4,'Fictional discussion and context',$5) returning id`,
  [input.contact,input.opportunity,input.scheduledAt,input.status,input.owner]));
  return result.rows[0].id;
}
type TaskValues = { contact: string | null; opportunity: string | null; owner: string };
async function followUp(meetingId: string, values: Partial<TaskValues> = {}, actor: string = ids.member) {
  const input: TaskValues = { contact: null, opportunity: null, owner: actor, ...values };
  return asActor(db, actor, tx => tx.query<{ id: string; meeting_id: string; contact_id: string | null; opportunity_id: string | null; remaining_work: string; status: string; created_by: string }>(`insert into public.activities
    (activity_type,work_category,meeting_id,contact_id,opportunity_id,owner_id,status,remaining_work,occurred_at,notes)
    values('task','independent_general',$1,$2,$3,$4,'open','Send the fictional meeting summary','2026-11-04T05:00:00Z','Fictional follow-up context')
    returning id,meeting_id,contact_id,opportunity_id,remaining_work,status,created_by`, [meetingId,input.contact,input.opportunity,input.owner]));
}
const financialSnapshot = `select 'expected' as kind,currency,sum(expected_amount)::text as amount from public.opportunities group by currency
  union all select 'actual',currency,sum(amount)::text from public.recognized_contributions group by currency
  union all select 'target',currency,sum(annual_amount)::text from public.target_plans group by currency
  order by kind,currency`;

describe("Meetings links and workflow integrity in PostgreSQL", () => {
  it("persists a contact-only meeting without requiring a company or financial opportunity", async () => {
    const id = await meeting();
    const result = await asActor(db, ids.colleague, tx => tx.query<{ contact_id: string; opportunity_id: null; company_id: null; description: string }>(`select m.contact_id,m.opportunity_id,c.company_id,m.description
      from public.meetings m join public.contacts c on c.id=m.contact_id where m.id=$1`, [id]));
    expect(result.rows).toEqual([{ contact_id: ids.individual, opportunity_id: null, company_id: null, description: "Fictional discussion and context" }]);
  });
  it("persists an opportunity-only meeting and exposes its structured contact context through joins", async () => {
    const id = await meeting({ contact: null, opportunity: ids.cashOpportunity });
    const result = await asActor(db, ids.member, tx => tx.query<{ contact_id: null; party: string; primary_contact: string; designation: string; email: string | null; phone: string | null }>(`select m.contact_id,o.contact_id as party,o.primary_contact_id as primary_contact,p.designation,p.email,p.phone
      from public.meetings m join public.opportunities o on o.id=m.opportunity_id join public.contacts p on p.id=o.primary_contact_id where m.id=$1`, [id]));
    expect(result.rows[0]).toMatchObject({ contact_id: null, party: ids.company, primary_contact: ids.person });
    expect(result.rows[0].designation).toBeTruthy(); expect(result.rows[0].email || result.rows[0].phone).toBeTruthy();
  });
  it.each([ids.company,ids.person,ids.secondary])("accepts the company opportunity party or designated contact %s", async contact => {
    const id = await meeting({ contact, opportunity: ids.cashOpportunity });
    expect((await asActor(db, ids.colleague, tx => tx.query("select id from public.meetings where id=$1", [id]))).rows).toHaveLength(1);
  });
  it("rejects missing links and unrelated opportunity contacts", async () => {
    await expect(meeting({ contact: null, opportunity: null })).rejects.toMatchObject({ code: "23514" });
    await expect(meeting({ contact: ids.individual, opportunity: ids.cashOpportunity })).rejects.toMatchObject({ code: "23514" });
    await expect(meeting({ contact: null, opportunity: "ffffffff-ffff-4fff-8fff-ffffffffffff" })).rejects.toMatchObject({ code: "23503" });
  });
  it("does not treat every person sharing a workplace as a designated opportunity contact", async () => {
    const person = await asActor(db, ids.member, tx => tx.query<{ id: string }>(`insert into public.contacts(kind,name,email,company_id)
      values('individual','Fictional unselected colleague','meeting-unselected@example.invalid',$1) returning id`, [ids.company]));
    await expect(meeting({ contact: person.rows[0].id, opportunity: ids.cashOpportunity })).rejects.toMatchObject({ code: "23514" });
  });
  it("stores offset input as the equivalent UTC instant and audits Scheduled to Done", async () => {
    const id = await meeting();
    const instant = await db.query<{ epoch: number }>("select extract(epoch from scheduled_at)::double precision as epoch from public.meetings where id=$1", [id]);
    expect(instant.rows[0].epoch).toBe(Date.parse("2026-11-03T04:15:00Z") / 1000);
    await asActor(db, ids.member, tx => tx.query("update public.meetings set status='done',description='Fictional completed discussion' where id=$1", [id]));
    const audit = await asActor(db, ids.colleague, tx => tx.query<{ actor_id: string; before: { status: string; scheduled_at: string; created_at: string }; after: { status: string; scheduled_at: string; created_at: string } }>(
      "select actor_id,before,after from public.audit_logs where entity='meetings' and entity_id=$1 and action='update'", [id]));
    expect(audit.rows).toHaveLength(1); expect(audit.rows[0].actor_id).toBe(ids.member);
    expect(audit.rows[0].before.status).toBe("scheduled"); expect(audit.rows[0].after.status).toBe("done");
    expect(audit.rows[0].after.scheduled_at).toBe(audit.rows[0].before.scheduled_at);
    expect(audit.rows[0].after.created_at).toBe(audit.rows[0].before.created_at);
  });
  it("rejects an unrecognized status and blank meeting title", async () => {
    await expect(meeting({ status: "completed" })).rejects.toMatchObject({ code: "23514" });
    const id = await meeting();
    await expect(asActor(db, ids.member, tx => tx.query("update public.meetings set title=' ' where id=$1", [id]))).rejects.toMatchObject({ code: "23514" });
  });
});

describe("Meetings authorization independently of application services", () => {
  it("allows PSE team reads while denying unrelated member edits", async () => {
    const id = await meeting({}, ids.colleague);
    expect((await asActor(db, ids.member, tx => tx.query("select id from public.meetings where id=$1", [id]))).rows).toHaveLength(1);
    expect((await asActor(db, ids.member, tx => tx.query("update public.meetings set description='Unauthorized edit' where id=$1 returning id", [id]))).rows).toEqual([]);
    expect((await asActor(db, ids.manager, tx => tx.query("update public.meetings set description='Fictional manager edit' where id=$1 returning id", [id]))).rows).toHaveLength(1);
  });
  it("allows owner/creator edits but limits assigning and reassigning owners to managers", async () => {
    await expect(meeting({ owner: ids.colleague })).rejects.toThrow();
    const id = await meeting();
    await expect(asActor(db, ids.member, tx => tx.query("update public.meetings set owner_id=$1 where id=$2", [ids.colleague,id]))).rejects.toMatchObject({ code: "42501" });
    await asActor(db, ids.manager, tx => tx.query("update public.meetings set owner_id=$1 where id=$2", [ids.colleague,id]));
    expect((await asActor(db, ids.colleague, tx => tx.query("update public.meetings set description='Fictional owner edit' where id=$1 returning id", [id]))).rows).toHaveLength(1);
    expect((await asActor(db, ids.member, tx => tx.query("update public.meetings set description='Fictional creator edit' where id=$1 returning id", [id]))).rows).toHaveLength(1);
    await expect(meeting({ owner: ids.inactive }, ids.manager)).rejects.toMatchObject({ code: "23514" });
    await expect(meeting({ owner: ids.outsider }, ids.manager)).rejects.toMatchObject({ code: "23514" });
  });
  it.each([ids.outsider,ids.inactive])("denies meeting/follow-up reads and writes to restricted profile %s", async actor => {
    expect((await asActor(db, actor, tx => tx.query("select id from public.meetings"))).rows).toEqual([]);
    expect((await asActor(db, actor, tx => tx.query("select id from public.activities"))).rows).toEqual([]);
    await expect(meeting({}, actor)).rejects.toThrow();
    await expect(followUp(ids.meeting, {}, actor)).rejects.toThrow();
  });
  it("denies anonymous access and forged creator identity", async () => {
    await expect(asActor(db, null, tx => tx.query("select id from public.meetings"))).rejects.toThrow(/permission/i);
    await expect(asActor(db, ids.member, tx => tx.query(`insert into public.meetings(contact_id,title,scheduled_at,owner_id,created_by)
      values($1,'Fictional spoofed meeting',now(),$2,$3)`, [ids.individual,ids.member,ids.manager]))).rejects.toThrow();
    const id = await meeting();
    await expect(asActor(db, ids.member, tx => tx.query("update public.meetings set created_by=$1 where id=$2", [ids.manager,id]))).rejects.toMatchObject({ code: "23514" });
    await expect(asActor(db, ids.member, tx => tx.query(`insert into public.activities(activity_type,owner_id,meeting_id,created_by)
      values('task',$1,$2,$3)`, [ids.member,id,ids.manager]))).rejects.toThrow();
  });
  it("allows a manager to maintain historical meeting notes after an owner is deactivated", async () => {
    const id = await meeting({}, ids.colleague);
    await db.query("update public.profiles set active=false where id=$1", [ids.colleague]);
    try {
      expect((await asActor(db, ids.manager, tx => tx.query("update public.meetings set description='Fictional historical context' where id=$1 returning id", [id]))).rows).toHaveLength(1);
      expect((await asActor(db, ids.colleague, tx => tx.query("update public.meetings set description='Inactive edit' where id=$1 returning id", [id]))).rows).toEqual([]);
    } finally { await db.query("update public.profiles set active=true where id=$1", [ids.colleague]); }
  });
});

describe("linked follow-up activities and financial separation", () => {
  it("stores a follow-up task with remaining work, notes and the canonical meeting link", async () => {
    const id = await meeting();
    const task = (await followUp(id)).rows[0];
    expect(task).toMatchObject({ meeting_id: id, contact_id: null, opportunity_id: null, remaining_work: "Send the fictional meeting summary", status: "open", created_by: ids.member });
    expect((await asActor(db, ids.colleague, tx => tx.query("select id from public.activities where id=$1", [task.id]))).rows).toHaveLength(1);
  });
  it("allows compatible company contact points on a follow-up and rejects contradictory links", async () => {
    const id = await meeting({ contact: ids.person, opportunity: ids.cashOpportunity });
    expect((await followUp(id, { contact: ids.secondary, opportunity: ids.cashOpportunity })).rows).toHaveLength(1);
    await expect(followUp(id, { contact: ids.individual })).rejects.toMatchObject({ code: "23514" });
    await expect(followUp(id, { opportunity: ids.usdOpportunity })).rejects.toMatchObject({ code: "23514" });
    await expect(followUp(id, { owner: ids.colleague })).rejects.toThrow();
  });
  it("blocks contact-only meeting edits that invalidate an explicitly linked follow-up contact", async () => {
    const id = await meeting({ contact: ids.person }); await followUp(id, { contact: ids.person });
    await expect(asActor(db, ids.member, tx => tx.query("update public.meetings set contact_id=$1 where id=$2", [ids.individual,id]))).rejects.toMatchObject({ code: "23514" });
    expect((await db.query<{ contact_id: string }>("select contact_id from public.meetings where id=$1", [id])).rows[0].contact_id).toBe(ids.person);
  });
  it("allows meeting contact changes when follow-ups use only the meeting link", async () => {
    const id = await meeting({ contact: ids.person }); await followUp(id);
    expect((await asActor(db, ids.member, tx => tx.query("update public.meetings set contact_id=$1 where id=$2 returning id", [ids.individual,id]))).rows).toHaveLength(1);
  });
  it("blocks changing a meeting opportunity underneath an explicitly attributed follow-up", async () => {
    const id = await meeting({ contact: null, opportunity: ids.cashOpportunity }); await followUp(id, { opportunity: ids.cashOpportunity, contact: ids.secondary });
    await expect(asActor(db, ids.member, tx => tx.query("update public.meetings set opportunity_id=$1 where id=$2", [ids.usdOpportunity,id]))).rejects.toMatchObject({ code: "23514" });
  });
  it("protects opportunity contact points used by indirectly linked meeting follow-ups", async () => {
    const id = await meeting({ contact: ids.company, opportunity: ids.cashOpportunity }); await followUp(id, { contact: ids.secondary });
    await expect(asActor(db, ids.manager, tx => tx.query("update public.opportunities set secondary_contact_id=null where id=$1", [ids.cashOpportunity]))).rejects.toMatchObject({ code: "23514" });
  });
  it("keeps meeting completion and follow-up work separate from forecast, actuals and targets", async () => {
    const before = (await db.query(financialSnapshot)).rows;
    const id = await meeting({ contact: ids.company, opportunity: ids.cashOpportunity });
    await asActor(db, ids.member, tx => tx.query("update public.meetings set status='done' where id=$1", [id]));
    const task = (await followUp(id)).rows[0];
    await asActor(db, ids.member, tx => tx.query("update public.activities set status='done',remaining_work=null where id=$1", [task.id]));
    expect((await db.query(financialSnapshot)).rows).toEqual(before);
  });
});
