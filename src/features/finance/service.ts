import "server-only";
import { z } from "zod";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile, isPseManager } from "@/lib/auth/roles";
import { contributionSchema, contributionFilters, targetSchema, verticalSchema } from "./schemas";
import { FinanceError } from "./types";
import type { FinanceRepository } from "./queries";
import { cents } from "./money";
function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues) (fields[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
  throw new FinanceError(422, "Review the financial record details.", fields);
}
function uuid(id: string) {
  if (!z.uuid().safeParse(id).success) throw new FinanceError(400, "Invalid record ID.");
  return id;
}
export function createFinanceService(repo: FinanceRepository, access: AccessResult) {
  function authorize(manager = false) {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.profile.id !== access.userId)
      throw new FinanceError(
        access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403,
        "Active PSE access required.",
      );
    if (manager && !isPseManager(access.profile)) throw new FinanceError(403, "An authorized PSE manager is required.");
    return access;
  }
  async function plan(id: string) {
    const result = await repo.plan(uuid(id));
    if (!result) throw new FinanceError(404, "Target plan not found.");
    return result;
  }
  return {
    async options() {
      authorize();
      return repo.options();
    },
    async opportunity(id: string) {
      authorize();
      const row = await repo.opportunity(uuid(id));
      if (!row) throw new FinanceError(404, "Opportunity not found.");
      return row;
    },
    async contributions(input: unknown) {
      authorize();
      return repo.contributions(parse(contributionFilters, input));
    },
    async contribution(id: string) {
      authorize();
      const row = await repo.contribution(uuid(id));
      if (!row) throw new FinanceError(404, "Contribution not found.");
      return row;
    },
    async record(input: unknown) {
      const actor = authorize(),
        data = parse(contributionSchema, input),
        [opportunity, options] = await Promise.all([repo.opportunity(data.opportunity_id), repo.options()]);
      if (!opportunity) throw new FinanceError(422, "Select an existing opportunity.");
      if (data.currency !== opportunity.currency || data.contribution_type !== opportunity.contribution_type)
        throw new FinanceError(
          422,
          "Currency and contribution type must match the opportunity. No currency conversion is applied.",
        );
      if (!options.employees.some(e => e.id === data.employee_id && e.active))
        throw new FinanceError(422, "Choose an active PSE employee.");
      if (data.target_vertical_id && !options.verticals.some(v => v.id === data.target_vertical_id && v.active))
        throw new FinanceError(422, "Choose an active target vertical or leave it unassigned.");
      return repo.record(data, actor.userId);
    },
    async plans(input: unknown) {
      authorize();
      const { page } = parse(z.object({ page: z.coerce.number().int().min(1).max(100000).default(1) }).strict(), input);
      return repo.plans(page);
    },
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
      const data = parse(targetSchema, input);
      return { id: await repo.save(data) };
    },
    async approve(id: string, input: unknown) {
      authorize(true);
      uuid(id);
      const { expected_updated_at } = parse(
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
      return repo.vertical(parse(verticalSchema, input));
    },
  };
}
