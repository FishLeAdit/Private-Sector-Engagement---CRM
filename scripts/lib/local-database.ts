import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";

export const fixtureIds = {
  manager: "00000000-0000-4000-8000-000000000001",
  member: "00000000-0000-4000-8000-000000000002",
  colleague: "00000000-0000-4000-8000-000000000003",
  outsider: "00000000-0000-4000-8000-000000000004",
  inactive: "00000000-0000-4000-8000-000000000005",
  company: "10000000-0000-4000-8000-000000000001",
  person: "10000000-0000-4000-8000-000000000002",
  secondary: "10000000-0000-4000-8000-000000000003",
  individual: "10000000-0000-4000-8000-000000000004",
  cashOpportunity: "20000000-0000-4000-8000-000000000001",
  inKindOpportunity: "20000000-0000-4000-8000-000000000002",
  usdOpportunity: "20000000-0000-4000-8000-000000000003",
  meeting: "30000000-0000-4000-8000-000000000001",
  approvedPlan: "60000000-0000-4000-8000-000000000001",
  draftPlan: "60000000-0000-4000-8000-000000000002",
  dsp: "50000000-0000-4000-8000-000000000001",
  vbd: "50000000-0000-4000-8000-000000000002",
} as const;

// Isolated test adapter only. Never apply this Auth stub to a Supabase project.
const localAuthBootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text unique not null);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export async function createLocalDatabase({ seed = true } = {}) {
  const db = await PGlite.create();
  try {
    await db.exec(localAuthBootstrap);
    const migrations = (await readdir(resolve("supabase/migrations")))
      .filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    for (const name of migrations) {
      const sql = await readFile(resolve("supabase/migrations", name), "utf8");
      await db.exec(sql);
    }
    if (seed) {
      for (const name of ["manager", "member", "colleague", "outsider", "inactive"] as const) {
        await db.query("insert into auth.users (id, email) values ($1, $2)", [
          fixtureIds[name],
          `${name}@example.invalid`,
        ]);
      }
      await db.exec(await readFile(resolve("supabase/seed.sql"), "utf8"));
    }
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
}

type Transaction = Parameters<Parameters<PGlite["transaction"]>[0]>[0];

export async function asActor<T>(db: PGlite, actor: string | null, run: (tx: Transaction) => Promise<T>) {
  return db.transaction(async tx => {
    await tx.exec(actor === null ? "set local role anon" : "set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [actor ?? ""]);
    return run(tx);
  });
}
