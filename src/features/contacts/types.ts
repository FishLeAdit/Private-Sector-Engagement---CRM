import type { Tables, TablesInsert } from "@/types/database.types";
import { AppError, type FieldErrors } from "@/lib/errors";
import type { ContactListInput } from "./schemas";

export type ContactRow = Tables<"contacts">;
export type ContactRecord = ContactRow & {
  company: { id: string; name: string } | null;
  creator: { id: string; display_name: string } | null;
};
export type CompanyOption = { id: string; name: string };
export type DuplicateContact = { id: string; name: string; fields: ("email" | "phone")[] };
export type ContactWrite = Pick<
  TablesInsert<"contacts">,
  "kind" | "name" | "email" | "phone" | "company_id" | "designation" | "website" | "industry" | "notes"
>;
export type ContactHistory = {
  opportunities: Pick<Tables<"opportunities">, "id" | "deal_name" | "expected_amount" | "currency" | "created_at">[];
  meetings: Pick<Tables<"meetings">, "id" | "title" | "scheduled_at" | "status">[];
  activities: Pick<Tables<"activities">, "id" | "activity_type" | "status" | "occurred_at" | "notes" | "created_at">[];
};
export interface ContactRepository {
  list(input: ContactListInput): Promise<{ contacts: ContactRecord[]; count: number }>;
  find(id: string): Promise<ContactRecord | null>;
  duplicates(
    email: string | null,
    phone: string | null,
    exclude?: string,
  ): Promise<Pick<ContactRow, "id" | "name" | "email_normalized" | "phone_normalized">[]>;
  create(input: ContactWrite, actorId: string): Promise<ContactRecord>;
  update(id: string, input: ContactWrite): Promise<ContactRecord | null>;
  remove(id: string): Promise<boolean>;
  history(id: string): Promise<ContactHistory>;
}

export class ContactError extends AppError {
  constructor(
    status: number,
    message: string,
    fields: FieldErrors = {},
    public duplicates: DuplicateContact[] = [],
  ) {
    super(status, message, fields);
    this.name = "ContactError";
  }
}

export type ContactApiError = { error: string; fields?: Record<string, string[]>; duplicates?: DuplicateContact[] };
