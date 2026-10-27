import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { isPseManager, isActivePseProfile } from "@/lib/auth/roles";
import {
  contactListSchema,
  contactPatchSchema,
  contactSchema,
  duplicateCheckSchema,
  normalizeEmail,
  normalizePhone,
  type ContactInput,
} from "./schemas";
import {
  ContactError,
  type ContactRecord,
  type ContactRepository,
  type ContactWrite,
  type DuplicateContact,
} from "./types";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new ContactError(422, "Review the highlighted contact details.", fields);
}
function validId(value: string) {
  if (!z.uuid().safeParse(value).success) throw new ContactError(400, "Invalid contact ID.");
  return value;
}

export function canEditContact(access: AccessResult, contact: Pick<ContactRecord, "created_by">) {
  return (
    access.status === "allowed" &&
    isActivePseProfile(access.profile) &&
    access.profile.id === access.userId &&
    (contact.created_by === access.userId || isPseManager(access.profile))
  );
}

function writeValues(input: ContactInput): ContactWrite {
  const nullable = (value: string) => value || null;
  return {
    kind: input.kind,
    name: input.name,
    email: normalizeEmail(input.email),
    phone: nullable(input.phone),
    company_id: nullable(input.company_id),
    designation: nullable(input.designation),
    website: nullable(input.website),
    industry: nullable(input.industry),
    notes: nullable(input.notes),
  };
}

export function createContactsService(repository: ContactRepository, access: AccessResult) {
  function authorize() {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.userId !== access.profile.id) {
      throw new ContactError(
        access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403,
        "PSE access is required.",
      );
    }
    return access;
  }
  async function requireContact(id: string) {
    const contact = await repository.find(validId(id));
    if (!contact) throw new ContactError(404, "Contact not found.");
    return contact;
  }
  async function duplicates(email: string, phone: string, exclude?: string): Promise<DuplicateContact[]> {
    const normalizedEmail = normalizeEmail(email),
      normalizedPhone = normalizePhone(phone);
    const found = await repository.duplicates(normalizedEmail, normalizedPhone, exclude);
    return found.map(row => ({
      id: row.id,
      name: row.name,
      fields: [
        ...(normalizedEmail && row.email_normalized === normalizedEmail ? ["email" as const] : []),
        ...(normalizedPhone && row.phone_normalized === normalizedPhone ? ["phone" as const] : []),
      ],
    }));
  }
  async function validateCompany(input: ContactInput, id?: string) {
    if (!input.company_id) return;
    if (input.company_id === id)
      throw new ContactError(422, "A contact cannot be its own company.", {
        company_id: ["Choose a different company."],
      });
    const company = await repository.find(input.company_id);
    if (company?.kind !== "company")
      throw new ContactError(422, "Choose an existing company.", {
        company_id: ["This company is no longer available."],
      });
  }
  async function rejectDuplicates(input: ContactInput, id?: string) {
    const found = await duplicates(input.email, input.phone, id);
    if (found.length) {
      const fields: Record<string, string[]> = {};
      for (const row of found) for (const field of row.fields) fields[field] = ["Already used by another contact."];
      throw new ContactError(409, "A contact with that email or phone already exists.", fields, found);
    }
  }
  return {
    async list(input: unknown) {
      authorize();
      return repository.list(parse(contactListSchema, input));
    },
    async get(id: string) {
      authorize();
      return requireContact(id);
    },
    async details(id: string) {
      authorize();
      const contact = await requireContact(id);
      return { contact, history: await repository.history(contact.id) };
    },
    async checkDuplicates(input: unknown) {
      authorize();
      const value = parse(duplicateCheckSchema, input);
      return duplicates(value.email, value.phone, value.exclude);
    },
    async create(input: unknown) {
      const actor = authorize();
      const data = parse(contactSchema, input);
      await validateCompany(data);
      await rejectDuplicates(data);
      return repository.create(writeValues(data), actor.userId);
    },
    async update(id: string, input: unknown) {
      authorize();
      const current = await requireContact(id);
      if (!canEditContact(access, current))
        throw new ContactError(403, "Only the creator or an authorized manager may edit this contact.");
      const patch = parse(contactPatchSchema, input);
      if (patch.kind && patch.kind !== current.kind)
        throw new ContactError(422, "Contact type cannot be changed after creation.", {
          kind: ["Keep the original contact type."],
        });
      const data = parse(contactSchema, {
        kind: current.kind,
        name: current.name,
        email: current.email ?? "",
        phone: current.phone ?? "",
        company_id: current.company_id ?? "",
        designation: current.designation ?? "",
        website: current.website ?? "",
        industry: current.industry ?? "",
        notes: current.notes ?? "",
        ...patch,
      });
      await validateCompany(data, id);
      await rejectDuplicates(data, id);
      const saved = await repository.update(id, writeValues(data));
      if (!saved)
        throw new ContactError(
          403,
          "This contact could not be updated. Your access may have changed; refresh and try again.",
        );
      return saved;
    },
    async remove(id: string) {
      authorize();
      const current = await requireContact(id);
      if (!canEditContact(access, current))
        throw new ContactError(403, "Only the creator or an authorized manager may delete this contact.");
      const removed = await repository.remove(current.id);
      if (!removed)
        throw new ContactError(
          403,
          "This contact could not be deleted. Your access may have changed; refresh and try again.",
        );
      return { deleted: true, id: current.id };
    },
  };
}
