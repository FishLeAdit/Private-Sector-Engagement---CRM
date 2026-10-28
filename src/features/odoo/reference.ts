import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Reference } from "./types";

const CHUNK = 1000; // Supabase returns at most 1,000 rows per request
type Failure = (action: string) => never;

// What a check compares against. The app passes the signed-in manager's own client, so RLS limits it to what
// they can read; the command line passes the service-role client. No server-only import, so both can use it.
export async function loadReference(client: SupabaseClient<Database>, fail: Failure): Promise<Reference> {
  async function all<T>(
    action: string,
    page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  ) {
    const rows: T[] = [];
    for (let start = 0; ; start += CHUNK) {
      const { data, error } = await page(start, start + CHUNK - 1);
      if (error) fail(action);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < CHUNK) return rows;
    }
  }
  const imported = (table: "contacts" | "opportunities" | "activities") =>
    all(`Reading imported ${table}`, (from, to) =>
      client.from(table).select("odoo_id").not("odoo_id", "is", null).order("id").range(from, to),
    ).then(rows => rows.map(row => row.odoo_id!));
  const [contacts, owners, stages, categories, ...ids] = await Promise.all([
    all("Reading existing contacts", (from, to) =>
      client.from("contacts").select("name,email_normalized,phone_normalized").order("id").range(from, to),
    ),
    all("Reading PSE profiles", (from, to) =>
      client
        .from("profiles")
        .select("id,display_name,active")
        .eq("department", "PSE")
        .in("role", ["pse_member", "pse_manager", "admin"])
        .order("id")
        .range(from, to),
    ),
    all("Reading pipeline stages", (from, to) =>
      client.from("pipeline_stages").select("id,name,active").order("id").range(from, to),
    ),
    all("Reading contribution categories", (from, to) =>
      client.from("contribution_categories").select("id,code,name,active").order("id").range(from, to),
    ),
    imported("contacts"),
    imported("opportunities"),
    imported("activities"),
  ]);
  return {
    contacts,
    owners,
    stages,
    categories,
    imported: { contacts: ids[0], deals: ids[1], activities: ids[2] },
  };
}
