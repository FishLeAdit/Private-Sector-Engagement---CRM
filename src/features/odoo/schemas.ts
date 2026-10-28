import { z } from "zod";

// The three exported CSV files as text. Any of them may be left out; larger exports go through the command line
// (`npm run odoo:dry-run`), which has no request size limit.
export const ODOO_FILE_LIMIT = 2_000_000; // characters, and bytes in the browser's pre-check
const file = z
  .string()
  .max(ODOO_FILE_LIMIT, "This file is too large to check here. Use npm run odoo:dry-run instead.")
  .default("");
export const odooCheckSchema = z.object({ contacts: file, deals: file, activities: file }).strict();
export type OdooCheckInput = z.output<typeof odooCheckSchema>;
