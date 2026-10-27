import { z } from "zod";
import type { AppErrorClass, FieldErrors } from "./errors";

// Throws a 422 that groups messages by top-level field, matching how forms highlight errors.
export function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown, ErrorClass: AppErrorClass, message: string): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: FieldErrors = {};
  for (const issue of result.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new ErrorClass(422, message, fields);
}

export function requireUuid(id: string, ErrorClass: AppErrorClass, message: string): string {
  if (!z.uuid().safeParse(id).success) throw new ErrorClass(400, message);
  return id;
}
