import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type { ImportRows } from "./import-plan";
import { loadReference } from "./reference";
import { OdooError } from "./types";

// Reads and the import run with the caller's own client, so RLS and the link triggers apply as for a form.
export function createOdooRepository(client: SupabaseClient<Database>) {
  return {
    reference: () =>
      loadReference(client, () => {
        throw new OdooError(503, "The project's contacts and configuration could not be read. Try again.");
      }),
    // One transaction: the whole batch is imported, or nothing is.
    async importRows(rows: ImportRows) {
      const { error } = await client.rpc("import_odoo", {
        p_contacts: rows.contacts as unknown as Json,
        p_deals: rows.deals as unknown as Json,
        p_activities: rows.activities as unknown as Json,
      });
      if (!error) return;
      if (error.code === "42501") throw new OdooError(403, "Only a PSE manager can import from Odoo.");
      if (error.code === "23505")
        throw new OdooError(
          409,
          "Nothing was imported: some rows were imported already, or a contact's email or phone is already in the CRM. Check the files again.",
        );
      if (["23514", "23503", "23502", "22P02", "22007", "22008"].includes(error.code ?? ""))
        throw new OdooError(422, "Nothing was imported: the database refused a row. Check the files again.");
      throw new OdooError(503, "Nothing was imported. The import is temporarily unavailable; try again.");
    },
  };
}
export type OdooRepository = ReturnType<typeof createOdooRepository>;
