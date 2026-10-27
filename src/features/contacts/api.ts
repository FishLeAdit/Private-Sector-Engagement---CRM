import "server-only";
import { createApiHandler, readJsonBody } from "@/lib/api/handler";
import { revalidateRecordPages } from "@/lib/cache/paths";
import { createContactRepository } from "./queries";
import { createContactsService } from "./service";
import { ContactError } from "./types";

export function readContactJson(request: Request) {
  return readJsonBody(request, ContactError, {
    maxLength: 65536,
    notJson: "Send contact details as JSON.",
    tooLarge: "Contact details are too large.",
    invalid: "Contact details contain invalid JSON.",
  });
}

export const contactApi = createApiHandler({
  ErrorClass: ContactError,
  createService: (client, access) => createContactsService(createContactRepository(client), access),
  crossOriginMessage: "Submit this request from the CRM application.",
  unavailableMessage: "Contacts are temporarily unavailable. Please try again.",
  errorBody: error => ({ error: error.message, fields: error.fields, duplicates: error.duplicates }),
});

// Contacts are not part of report aggregates, so only contact pages need re-rendering.
export function invalidateContact(id: string) {
  revalidateRecordPages("/contacts", id);
}
