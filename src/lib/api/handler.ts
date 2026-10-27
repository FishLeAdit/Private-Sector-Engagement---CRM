import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { authorizeApi } from "@/lib/auth/access";
import type { AccessResult } from "@/lib/auth/session";
import type { AppError, AppErrorClass } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

export const noStoreHeaders = { "Cache-Control": "private, no-store" };

export type ApiResult = { data: unknown; status?: number };

export function requireSameOrigin(request: Request, ErrorClass: AppErrorClass, message: string) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new ErrorClass(403, message);
}

export async function readJsonBody(
  request: Request,
  ErrorClass: AppErrorClass,
  limits: { maxLength: number; notJson: string; tooLarge: string; invalid: string },
): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new ErrorClass(415, limits.notJson);
  }
  const text = await request.text();
  if (text.length > limits.maxLength) throw new ErrorClass(413, limits.tooLarge);
  try {
    return JSON.parse(text);
  } catch {
    throw new ErrorClass(400, limits.invalid);
  }
}

type ApiOptions<S, E extends AppError> = {
  ErrorClass: AppErrorClass<E>;
  createService: (client: SupabaseClient<Database>, access: AccessResult) => S;
  crossOriginMessage: string;
  unavailableMessage: string;
  errorBody?: (error: E) => Record<string, unknown>;
};

// Authorizes the caller, rejects cross-site writes, runs the module service and maps its errors to JSON.
// Responses are never cached: they carry private, per-user CRM data.
export function createApiHandler<S, E extends AppError>(options: ApiOptions<S, E>) {
  const errorBody = options.errorBody ?? ((error: E) => ({ error: error.message, fields: error.fields }));
  return async function handle(
    request: Request,
    run: (service: S) => Promise<ApiResult>,
    mutation = false,
    manager = false,
  ) {
    const auth = await authorizeApi({ manager });
    if (!auth.ok) return auth.response;
    try {
      if (mutation) requireSameOrigin(request, options.ErrorClass, options.crossOriginMessage);
      const service = options.createService(await createClient(), auth.access);
      const result = await run(service);
      return NextResponse.json(result.data, { status: result.status ?? 200, headers: noStoreHeaders });
    } catch (error) {
      if (error instanceof options.ErrorClass) {
        return NextResponse.json(errorBody(error), { status: error.status, headers: noStoreHeaders });
      }
      return NextResponse.json({ error: options.unavailableMessage }, { status: 503, headers: noStoreHeaders });
    }
  };
}
