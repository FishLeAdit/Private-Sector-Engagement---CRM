import "server-only";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { createOdooRepository } from "./queries";
import { ODOO_FILE_LIMIT } from "./schemas";
import { createOdooService } from "./service";
import { OdooError } from "./types";

// Three files at their limit, plus the JSON around them.
export function readOdooJson(request: Request) {
  return readJsonBody(request, OdooError, {
    maxLength: ODOO_FILE_LIMIT * 3 + 1000,
    notJson: "Send the files as JSON.",
    tooLarge: "These files are too large to check here. Use npm run odoo:dry-run instead.",
    invalid: "The request contains invalid JSON.",
  });
}

export const odooApi = createApiHandler({
  ErrorClass: OdooError,
  createService: (client, access) => createOdooService(createOdooRepository(client), access),
  crossOriginMessage: "Run the check from this CRM application.",
  unavailableMessage: "The import check is temporarily unavailable. Please try again.",
});
