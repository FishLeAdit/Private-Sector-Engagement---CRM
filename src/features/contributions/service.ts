import "server-only";
import type { AccessResult } from "@/lib/auth/session";
import { isPseManager } from "@/lib/auth/roles";
import { authorizeFinance, financeId, parseFinance } from "@/features/finance/guards";
import { FinanceError } from "@/features/finance/types";
import { cents, decimal, money, signedCents } from "@/lib/money";
import { contributionFilters, contributionSchema, correctionSchema } from "./schemas";
import type { ContributionRepository } from "./queries";

type DealStage = { name: string; is_closed: boolean; outcome: string | null } | null | undefined;

// New receipts are accepted while a deal is open or won. Receipts recorded earlier stay valid if the deal
// later closes, because that money was received. Migration 0012 enforces the same rule in the database.
export function acceptsContributions(stage: DealStage) {
  return !stage?.is_closed || stage.outcome === "won";
}

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
      if (!acceptsContributions(opportunity.stage))
        throw new FinanceError(
          422,
          `This deal is ${opportunity.stage?.name ?? "closed"}. Contributions can only be recorded on open or won deals.`,
        );
      if (data.currency !== opportunity.currency || data.contribution_type !== opportunity.contribution_type)
        throw new FinanceError(
          422,
          "Currency and contribution type must match the opportunity. No currency conversion is applied.",
        );
      if (!options.employees.some(e => e.id === data.employee_id && e.active))
        throw new FinanceError(422, "Choose an active PSE employee.");
      // Members credit themselves; a manager may credit any active employee. RLS (migration 0013) agrees.
      if (data.employee_id !== actor.userId && !isPseManager(actor.profile))
        throw new FinanceError(403, "Only a PSE manager can credit a contribution to another employee.", {
          employee_id: ["Credit the contribution to yourself, or ask a PSE manager to record it."],
        });
      if (data.target_vertical_id && !options.verticals.some(v => v.id === data.target_vertical_id && v.active))
        throw new FinanceError(422, "Choose an active target vertical or leave it unassigned.");
      return repo.record(data, actor.userId);
    },
    async corrections(id: string) {
      authorize();
      return repo.corrections(financeId(id));
    },
    // A manager reverses part or all of a receipt with a new negative entry; the receipt itself is never edited.
    // Migration 0015 enforces the same rules. A retry of the same request_id is not counted against itself.
    async correct(id: string, input: unknown) {
      const actor = authorizeFinance(access, true);
      const data = parseFinance(correctionSchema, input);
      const original = await repo.contribution(financeId(id));
      if (!original) throw new FinanceError(404, "Contribution not found.");
      if (original.corrects_contribution_id) throw new FinanceError(422, "A correction cannot itself be corrected.");
      const corrections = await repo.corrections(original.id);
      const left = remainingAmount(
        original.amount,
        corrections.filter(c => c.id !== data.request_id),
      );
      if (cents(data.amount) > left)
        throw new FinanceError(422, "A correction cannot take a contribution below zero.", {
          amount: [`At most ${money(decimal(left), original.currency)} of this contribution can still be reversed.`],
        });
      return repo.correct(original.id, data, actor.userId);
    },
  };
}

// What is left of a receipt after its corrections, in cents.
export function remainingAmount(amount: string | number, corrections: { amount: string | number }[]) {
  return corrections.reduce((sum, c) => sum + signedCents(c.amount), signedCents(amount));
}
