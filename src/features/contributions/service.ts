import "server-only";
import type { AccessResult } from "@/lib/auth/session";
import { authorizeFinance, financeId, parseFinance } from "@/features/finance/guards";
import { FinanceError } from "@/features/finance/types";
import { contributionFilters, contributionSchema } from "./schemas";
import type { ContributionRepository } from "./queries";

export function createContributionsService(repo: ContributionRepository, access: AccessResult) {
  const authorize = () => authorizeFinance(access);
  return {
    async options() {
      authorize();
      return repo.options();
    },
    async opportunity(id: string) {
      authorize();
      const row = await repo.opportunity(financeId(id));
      if (!row) throw new FinanceError(404, "Opportunity not found.");
      return row;
    },
    async contributions(input: unknown) {
      authorize();
      return repo.contributions(parseFinance(contributionFilters, input));
    },
    async contribution(id: string) {
      authorize();
      const row = await repo.contribution(financeId(id));
      if (!row) throw new FinanceError(404, "Contribution not found.");
      return row;
    },
    // Actual support is entered separately from the deal's expected value; nothing is copied or converted.
    async record(input: unknown) {
      const actor = authorize();
      const data = parseFinance(contributionSchema, input);
      const [opportunity, options] = await Promise.all([repo.opportunity(data.opportunity_id), repo.options()]);
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
  };
}
