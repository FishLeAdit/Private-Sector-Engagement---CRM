import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asActor, createLocalDatabase, fixtureIds as ids } from "../../scripts/lib/local-database";

let db: PGlite;
const superadmin = "00000000-0000-4000-8000-0000000000a1",
  fresh = "00000000-0000-4000-8000-0000000000a2";
beforeAll(async () => {
  db = await createLocalDatabase();
  // A superadmin, and a sign-in account that has no profile yet (as the server creates it).
  await db.query(
    "insert into auth.users (id, email) values ($1,'super@fictional.example'),($2,'new@fictional.example')",
    [superadmin, fresh],
  );
  await db.query(
    "insert into public.profiles (id, display_name, department, role) values ($1,'Fictional Superadmin','PSE','admin')",
    [superadmin],
  );
});
afterAll(async () => {
  await db?.close();
});
const call = (actor: string | null, sql: string, params: unknown[] = []) =>
  asActor(db, actor, tx => tx.query<Record<string, unknown>>(sql, params)).then(result => result.rows);
const save = (actor: string | null, id: string, values: [string, string, string, boolean]) =>
  call(actor, "select public.admin_save_profile($1,$2,$3,$4,$5)", [id, ...values]);
const profile = (id: string) =>
  db
    .query<Record<string, unknown>>("select display_name,department,role,active from public.profiles where id=$1", [id])
    .then(result => result.rows[0]);

describe("superadmin account management", () => {
  it("lists every sign-in account with its profile, including accounts without one", async () => {
    const [{ accounts }] = await call(superadmin, "select public.admin_list_accounts() as accounts");
    const list = accounts as { id: string; email: string; display_name: string | null }[];
    expect(list.find(a => a.id === fresh)).toMatchObject({ email: "new@fictional.example", display_name: null });
    expect(list.find(a => a.id === ids.outsider)).toMatchObject({ display_name: "Demo Other Department" });
  });
  it.each([ids.manager, ids.member, ids.outsider, ids.inactive, null])(
    "refuses every account function to %s",
    async actor => {
      for (const sql of [
        "select public.admin_list_accounts()",
        `select public.admin_save_profile('${fresh}','X','PSE','admin',true)`,
        `select public.admin_delete_profile('${ids.colleague}')`,
      ])
        await expect(call(actor, sql)).rejects.toThrow();
    },
  );
  it("creates a profile for a new sign-in, then changes its role, department and access", async () => {
    await save(superadmin, fresh, ["  Fictional Newcomer ", "PSE", "pse_member", true]);
    expect(await profile(fresh)).toEqual({
      display_name: "Fictional Newcomer",
      department: "PSE",
      role: "pse_member",
      active: true,
    });
    await save(superadmin, fresh, ["Fictional Newcomer", "PSE", "pse_manager", false]);
    expect(await profile(fresh)).toMatchObject({ role: "pse_manager", active: false });
    await expect(save(superadmin, fresh, ["Fictional Newcomer", "PSE", "owner", true])).rejects.toMatchObject({
      code: "23514",
    });
    const audit = await db.query<{ actor_id: string }>(
      "select actor_id from public.audit_logs where entity='profiles' and entity_id=$1",
      [fresh],
    );
    expect(audit.rows.every(row => row.actor_id === superadmin)).toBe(true);
  });
  it("needs an existing sign-in for a new profile and never lets a superadmin remove their own access", async () => {
    await expect(
      save(superadmin, "00000000-0000-4000-8000-0000000000ff", ["Ghost", "PSE", "pse_member", true]),
    ).rejects.toMatchObject({
      code: "P0002",
    });
    for (const values of [
      ["Me", "PSE", "pse_manager", true],
      ["Me", "PSE", "admin", false],
      ["Me", "HR", "admin", true],
    ] as [string, string, string, boolean][])
      await expect(save(superadmin, superadmin, values)).rejects.toThrow(/own superadmin access/);
    await save(superadmin, superadmin, ["Renamed Superadmin", "PSE", "admin", true]);
    expect(await profile(superadmin)).toMatchObject({ display_name: "Renamed Superadmin" });
  });
  it("reads other departments' profiles, which members cannot", async () => {
    const seen = (actor: string) =>
      call(actor, "select id from public.profiles where department <> 'PSE'").then(rows => rows.length);
    expect(await seen(superadmin)).toBeGreaterThan(0);
    expect(await seen(ids.manager)).toBe(0);
  });
  it("deletes an unused profile but refuses one with history, and never the caller", async () => {
    // Referenced through ON DELETE RESTRICT (23001) or a plain foreign key (23503); both map to the same 409.
    await expect(call(superadmin, "select public.admin_delete_profile($1)", [ids.manager])).rejects.toSatisfy(
      (error: { code?: string }) => ["23001", "23503"].includes(error.code ?? ""),
    );
    await expect(call(superadmin, "select public.admin_delete_profile($1)", [superadmin])).rejects.toThrow(
      /your own account/,
    );
    await call(superadmin, "select public.admin_delete_profile($1)", [fresh]);
    expect(await profile(fresh)).toBeUndefined();
    await expect(call(superadmin, "select public.admin_delete_profile($1)", [fresh])).rejects.toMatchObject({
      code: "P0002",
    });
  });
  it("deletes a draft target plan with its cells, never an approved one, and only as a superadmin", async () => {
    const remove = (actor: string, plan: string) => call(actor, "select public.admin_delete_target_draft($1)", [plan]);
    await expect(remove(ids.manager, ids.draftPlan)).rejects.toMatchObject({ code: "42501" });
    await expect(remove(superadmin, ids.approvedPlan)).rejects.toThrow(/fixed/);
    await expect(call(ids.manager, "delete from public.target_plans where id=$1", [ids.draftPlan])).rejects.toThrow();
    await remove(superadmin, ids.draftPlan);
    for (const table of ["target_plans", "target_quarters", "target_allocations"]) {
      const column = table === "target_plans" ? "id" : "plan_id";
      expect((await db.query(`select 1 from public.${table} where ${column}=$1`, [ids.draftPlan])).rows).toEqual([]);
    }
    expect((await db.query("select 1 from public.target_plans where id=$1", [ids.approvedPlan])).rows).toHaveLength(1);
  });
});
