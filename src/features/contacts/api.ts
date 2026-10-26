import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createContactRepository } from "./queries";
import { createContactsService } from "./service";
import { ContactError } from "./types";

const headers = { "Cache-Control": "private, no-store" };
type Service = ReturnType<typeof createContactsService>;

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ContactError(403, "Submit this request from the CRM application.");
}

export async function readContactJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ContactError(415, "Send contact details as JSON.");
  }
  const text = await request.text();
  if (text.length > 65536) throw new ContactError(413, "Contact details are too large.");
  try { return JSON.parse(text); } catch { throw new ContactError(400, "Contact details contain invalid JSON."); }
}

export async function contactApi(request: Request, run: (service: Service) => Promise<{ data: unknown; status?: number }>, mutation = false) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  try {
    if (mutation) requireSameOrigin(request);
    const service = createContactsService(createContactRepository(await createClient()), auth.access);
    const result = await run(service);
    return NextResponse.json(result.data, { status: result.status ?? 200, headers });
  } catch (error) {
    if (error instanceof ContactError) {
      return NextResponse.json({ error: error.message, fields: error.fields, duplicates: error.duplicates }, { status: error.status, headers });
    }
    return NextResponse.json({ error: "Contacts are temporarily unavailable. Please try again." }, { status: 503, headers });
  }
}

export function invalidateContact(id: string) {
  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  revalidatePath(`/contacts/${id}/edit`);
}
