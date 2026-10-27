import "server-only";
import type { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { assertVerifiedPse } from "@/lib/auth/guards";
import { isPseManager } from "@/lib/auth/roles";
import { parseOrThrow, requireUuid } from "@/lib/validation";
import { FinanceError } from "./types";

export const parseFinance = <T>(schema: z.ZodType<T>, input: unknown) =>
  parseOrThrow(schema, input, FinanceError, "Review the financial record details.");

export const financeId = (id: string) => requireUuid(id, FinanceError, "Invalid record ID.");

// Every PSE member may read and record support; target and vertical changes need a manager.
export function authorizeFinance(access: AccessResult, manager = false) {
  const actor = assertVerifiedPse(access, FinanceError, "Active PSE access required.");
  if (manager && !isPseManager(actor.profile)) throw new FinanceError(403, "An authorized PSE manager is required.");
  return actor;
}
