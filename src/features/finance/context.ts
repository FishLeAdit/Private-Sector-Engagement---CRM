import { invalidateReportCache } from "@/lib/cache/invalidation";
import "server-only";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeApi, requirePseUser } from "@/lib/auth/access";
import { createClient } from "@/lib/supabase/server";
import { createFinanceRepository } from "./queries";
import { createFinanceService } from "./service";
import { FinanceError } from "./types";
export async function financePage() {
  const access = await requirePseUser();
  return { access, service: createFinanceService(createFinanceRepository(await createClient()), access) };
}
export async function financeData<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (error instanceof FinanceError) return { ok: false as const, error };
    throw error;
  }
}
export async function financeJson(request: Request) {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new FinanceError(415, "Send JSON.");
  const text = await request.text();
  if (text.length > 1000000) throw new FinanceError(413, "This financial form is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new FinanceError(400, "Invalid JSON.");
  }
}
export async function financeApi(
  request: Request,
  run: (service: ReturnType<typeof createFinanceService>) => Promise<unknown>,
  mutation = false,
  manager = false,
) {
  const auth = await authorizeApi({ manager });
  if (!auth.ok) return auth.response;
  const headers = { "Cache-Control": "private, no-store" };
  try {
    if (mutation && request.headers.get("origin") !== new URL(request.url).origin)
      throw new FinanceError(403, "Submit from this CRM application.");
    return NextResponse.json(
      await run(createFinanceService(createFinanceRepository(await createClient()), auth.access)),
      { headers },
    );
  } catch (error) {
    if (error instanceof FinanceError)
      return NextResponse.json({ error: error.message, fields: error.fields }, { status: error.status, headers });
    return NextResponse.json({ error: "Financial records are temporarily unavailable." }, { status: 503, headers });
  }
}
export function invalidateFinance() {
  invalidateReportCache(true);
  for (const path of ["/targets", "/contributions", "/opportunities", "/dashboard", "/reports"])
    revalidatePath(path, "layout");
}
