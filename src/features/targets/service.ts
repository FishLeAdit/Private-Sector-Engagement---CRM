import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { cents } from "@/lib/money";
import { authorizeFinance, financeId, parseFinance } from "@/features/finance/guards";
import { FinanceError } from "@/features/finance/types";
import { targetSchema, verticalSchema } from "./schemas";
import type { TargetRepository } from "./queries";

export function createTargetsService(repo: TargetRepository, access: AccessResult) {
  const authorize = (manager = false) => authorizeFinance(access, manager);
  async function plan(id: string) {
    const result = await repo.plan(financeId(id));
    if (!result) throw new FinanceError(404, "Target plan not found.");
    return result;
  }
  return {
    async options() {
      authorize();
      return repo.options();
    },
    async plans(input: unknown) {
      authorize();
      const { page } = parseFinance(
        z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(),
        input,
      );
      return repo.plans(page);
    },
    // Rejects a view assembled from two different draft versions.
    async details(id: string) {
      authorize();
      const row = await plan(id);
      const [allocations, actuals, audits] = await Promise.all([
        repo.allocations(id),
        repo.actuals(id),
        repo.history(id),
      ]);
      const current = await plan(id);
      if (current.updated_at !== row.updated_at || current.status !== row.status)
        throw new FinanceError(409, "This plan changed while loading. Refresh to view its current allocations.");
      return { plan: row, allocations, actuals, audits };
    },
    async save(input: unknown) {
      authorize(true);
      const data = parseFinance(targetSchema, input);
      return { id: await repo.save(data) };
    },
    // Approval locks the plan, so Q1–Q4 must equal the annual amount and each quarter's cells its baseline.
    async approve(id: string, input: unknown) {
      authorize(true);
      financeId(id);
      const { expected_updated_at } = parseFinance(
        z.object({ expected_updated_at: z.iso.datetime({ offset: true }) }).strict(),
        input,
      );
      const row = await plan(id);
      if (row.status !== "draft") throw new FinanceError(409, "This plan is already approved and locked.");
      const allocations = await repo.allocations(id);
      if (
        row.quarters.length !== 4 ||
        row.quarters.reduce((total, q) => total + cents(q.amount), 0n) !== cents(row.annual_amount)
      )
        throw new FinanceError(422, "Q1–Q4 must add up to the annual target.");
      for (const q of row.quarters)
        if (
          allocations.filter(a => a.quarter === q.quarter).reduce((total, a) => total + cents(a.amount), 0n) !==
          cents(q.amount)
        )
          throw new FinanceError(422, `Employee/vertical allocations must match Q${q.quarter}.`);
      return { id: await repo.approve(id, expected_updated_at) };
    },
    async vertical(input: unknown) {
      authorize(true);
      return repo.vertical(parseFinance(verticalSchema, input));
    },
  };
}
