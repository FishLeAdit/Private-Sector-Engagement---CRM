import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";
import type { AccessResult } from "../../src/lib/auth/session";
import type { ContactRecord, ContactRepository, ContactWrite } from "../../src/features/contacts/types";
vi.mock("server-only", () => ({}));
import { createContactsService } from "../../src/features/contacts/service";
import { contactPatchSchema, contactSchema, normalizePhone } from "../../src/features/contacts/schemas";

let db: PGlite;
beforeAll(async () => {
  db = await createLocalDatabase();
});
afterAll(async () => {
  await db?.close();
});

function accessFor(actorId: string, role = "pse_member"): AccessResult {
  return {
    status: "allowed",
    userId: actorId,
    profile: {
      id: actorId,
      display_name: "Fictional Test User",
      department: "PSE",
      active: true,
      role: role as "pse_member" | "pse_manager",
    },
  };
}

// Test repository executes the shared business service against real SQL/RLS.
// Production PostgREST request construction is covered independently.
function postgresRepository(actorId: string): ContactRepository {
  const query = <T>(sql: string, params: unknown[] = []) => asActor(db, actorId, tx => tx.query<T>(sql, params));
  const columns = [
    "kind",
    "name",
    "email",
    "phone",
    "company_id",
    "designation",
    "website",
    "industry",
    "notes",
  ] as const;
  const select = `select c.*,case when company.id is not null then json_build_object('id',company.id,'name',company.name) else null end as company,
    case when p.id is not null then json_build_object('id',p.id,'display_name',p.display_name) else null end as creator
    from public.contacts c left join public.contacts company on company.id=c.company_id left join public.profiles p on p.id=c.created_by`;
  async function find(id: string) {
    return (await query<ContactRecord>(`${select} where c.id=$1`, [id])).rows[0] ?? null;
  }
  return {
    find,
    async list(input) {
      const contacts = (
        await query<ContactRecord>(
          `${select} where ($1='all' or c.kind=$1) and c.name ilike $2 order by c.name,c.id limit 20 offset $3`,
          [input.kind, `%${input.q}%`, (input.page - 1) * 20],
        )
      ).rows;
      return { contacts, count: contacts.length };
    },
    async duplicates(email, phone, exclude) {
      return (
        await query<Pick<ContactRecord, "id" | "name" | "email_normalized" | "phone_normalized">>(
          "select id,name,email_normalized,phone_normalized from public.contacts where (email_normalized=$1 or phone_normalized=$2) and ($3::uuid is null or id<>$3::uuid)",
          [email, phone, exclude ?? null],
        )
      ).rows;
    },
    async create(input, creator) {
      const values = columns.map(key => input[key] ?? null);
      const result = await query<{ id: string }>(
        `insert into public.contacts(${columns.join(",")},created_by) values(${values.map((_, index) => `$${index + 1}`).join(",")},$10) returning id`,
        [...values, creator],
      );
      return (await find(result.rows[0].id))!;
    },
    async update(id: string, input: ContactWrite) {
      const result = await query<{ id: string }>(
        `update public.contacts set ${columns.map((key, index) => `${key}=$${index + 1}`).join(",")} where id=$10 returning id`,
        [...columns.map(key => input[key] ?? null), id],
      );
      return result.rows.length ? find(id) : null;
    },
    async remove(id) {
      return (await query("delete from public.contacts where id=$1 returning id", [id])).rows.length === 1;
    },
    async history() {
      return { opportunities: [], meetings: [], activities: [] };
    },
  };
}

function service(actor = ids.member as string, role = "pse_member") {
  return createContactsService(postgresRepository(actor), accessFor(actor, role));
}

describe("Contacts workflow through shared services and PostgreSQL", () => {
  it("creates a phone-only individual with no company and reloads it", async () => {
    const contact = await service().create({
      kind: "individual",
      name: "Fictional Phone Workflow",
      phone: "+880 1700 008001",
    });
    expect(contact.company_id).toBeNull();
    expect(contact.created_by).toBe(ids.member);
    expect((await service().get(contact.id)).phone_normalized).toBe("8801700008001");
  });
  it("creates a company with optional fields and stores company/notes as structured data", async () => {
    const company = await service().create({
      kind: "company",
      name: "Fictional Workflow Company",
      email: " COMPANY@EXAMPLE.INVALID ",
      website: "https://example.invalid",
      industry: "Education",
      notes: "Fictional referral. https://drive.google.com/file/d/demo/view",
    });
    expect(company.email).toBe("company@example.invalid");
    const person = await service().create({
      kind: "individual",
      name: "Fictional Associated Person",
      email: "associated@example.invalid",
      company_id: company.id,
      designation: "Demo coordinator",
    });
    expect(person.company?.name).toBe(company.name);
    expect((await service().get(company.id)).notes).toContain("drive.google.com");
  });
  it("requires communication details and rejects invalid URLs/phone text", async () => {
    await expect(service().create({ kind: "individual", name: "Missing communication" })).rejects.toMatchObject({
      status: 422,
    });
    await expect(
      service().create({
        kind: "company",
        name: "Bad URL",
        email: "badurl@example.invalid",
        website: "javascript:alert(1)",
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(service().create({ kind: "individual", name: "Bad phone", phone: "abc123" })).rejects.toMatchObject({
      status: 422,
    });
  });
  it("warns about matching normalized email and phone, even on different records", async () => {
    const result = await service().checkDuplicates({ email: " ONE@EXAMPLE.INVALID ", phone: "+880 (1700) 000004" });
    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ids.person, fields: ["email"] }),
        expect.objectContaining({ id: ids.individual, fields: ["phone"] }),
      ]),
    );
    await expect(
      service().create({ kind: "individual", name: "Duplicate", email: " ONE@EXAMPLE.INVALID " }),
    ).rejects.toMatchObject({ status: 409, fields: { email: expect.any(Array) } });
    await expect(
      service().create({ kind: "individual", name: "Duplicate", phone: "+880 (1700) 000004" }),
    ).rejects.toMatchObject({ status: 409, fields: { phone: expect.any(Array) } });
  });
  it("excludes the edited contact from duplicate checks", async () => {
    expect(await service().checkDuplicates({ phone: "+8801700000004", exclude: ids.individual })).toEqual([]);
    const saved = await service(ids.manager, "pse_manager").update(ids.individual, { phone: "+880 (1700) 000004" });
    expect(normalizePhone(saved.phone)).toBe("8801700000004");
  });
  it("preserves unspecified values on a partial update", async () => {
    expect(contactPatchSchema.parse({ notes: "Only notes changed" })).toEqual({ notes: "Only notes changed" });
    const contact = await service().create({
      kind: "individual",
      name: "Fictional Partial Update",
      email: "partial@example.invalid",
      phone: "+8801700008002",
      designation: "Original title",
    });
    const updated = await service().update(contact.id, { notes: "Only notes changed" });
    expect(updated.email).toBe("partial@example.invalid");
    expect(updated.phone).toBe("+8801700008002");
    expect(updated.designation).toBe("Original title");
    expect(updated.notes).toBe("Only notes changed");
  });
  it("cannot clear both communication fields or change contact type", async () => {
    const manager = service(ids.manager, "pse_manager");
    await expect(manager.update(ids.person, { email: "", phone: "" })).rejects.toMatchObject({ status: 422 });
    await expect(manager.update(ids.company, { kind: "individual" })).rejects.toMatchObject({ status: 422 });
  });
  it("rejects non-company associations and self-associations", async () => {
    await expect(
      service().create({
        kind: "individual",
        name: "Wrong company",
        email: "wrongcompany@example.invalid",
        company_id: ids.person,
      }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      service(ids.manager, "pse_manager").update(ids.person, { company_id: ids.person }),
    ).rejects.toMatchObject({ status: 422 });
    expect(
      contactSchema.safeParse({
        kind: "company",
        name: "Nested company",
        email: "nested@example.invalid",
        company_id: ids.company,
      }).success,
    ).toBe(false);
  });
  it("permits team reads but denies member edits to another creator's contact", async () => {
    expect((await service().get(ids.company)).name).toContain("Fictional");
    await expect(service().update(ids.company, { notes: "Unauthorized" })).rejects.toMatchObject({ status: 403 });
    expect((await service(ids.manager, "pse_manager").update(ids.company, { notes: "Manager edit" })).notes).toBe(
      "Manager edit",
    );
  });
  it("rejects mass-assignment of identity and creator fields", async () => {
    await expect(
      service().create({ kind: "individual", name: "Spoof", email: "spoof@example.invalid", created_by: ids.manager }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      service(ids.manager, "pse_manager").update(ids.person, { created_by: ids.member }),
    ).rejects.toMatchObject({ status: 422 });
  });
  it("returns safe not-found and invalid-ID errors", async () => {
    await expect(service().get("invalid-id")).rejects.toMatchObject({ status: 400 });
    await expect(service().get("ffffffff-ffff-4fff-8fff-ffffffffffff")).rejects.toMatchObject({ status: 404 });
  });
  it("deletes an unlinked contact as creator and as an authorized manager", async () => {
    const contact = await service().create({
      kind: "individual",
      name: "Fictional Delete Own",
      email: "delete-own@example.invalid",
    });
    expect(await service().remove(contact.id)).toEqual({ deleted: true, id: contact.id });
    await expect(service().get(contact.id)).rejects.toMatchObject({ status: 404 });
    const colleagueContact = await service().create({
      kind: "individual",
      name: "Fictional Manager Delete",
      email: "delete-manager@example.invalid",
    });
    expect((await service(ids.manager, "pse_manager").remove(colleagueContact.id)).deleted).toBe(true);
  });
  it("denies deleting a colleague's record before calling the repository", async () => {
    const repo = postgresRepository(ids.member);
    const remove = vi.spyOn(repo, "remove");
    await expect(createContactsService(repo, accessFor(ids.member)).remove(ids.person)).rejects.toMatchObject({
      status: 403,
    });
    expect(remove).not.toHaveBeenCalled();
  });
  it.each(["anonymous", "forbidden", "unavailable"] as const)(
    "never accesses contacts for %s requests",
    async status => {
      const repo = postgresRepository(ids.member);
      const find = vi.spyOn(repo, "find");
      await expect(createContactsService(repo, { status }).get(ids.person)).rejects.toBeInstanceOf(Error);
      await expect(createContactsService(repo, { status }).remove(ids.person)).rejects.toBeInstanceOf(Error);
      expect(find).not.toHaveBeenCalled();
    },
  );
});
