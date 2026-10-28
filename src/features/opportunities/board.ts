import { cents } from "@/lib/money";
import type { OpportunityRecord, Stage } from "./types";

// The stage board shows every matching deal: counts and expected totals cover them all, and each stage lists
// its latest cards first, with "Show more" raising that stage's limit through the `cards` URL parameter.
export const BOARD_CARDS = 10;
export const BOARD_STEP = 20;
export const BOARD_MAX = 500;

export type SummaryRow = { stage_id: string; currency: string; expected_amount: number | string };
export type Totals = Map<string, bigint>; // currency → expected value in cents; currencies are never combined
export type PipelineSummary = { count: number; totals: Totals; stages: Map<string, { count: number; totals: Totals }> };
export type BoardColumn = { stage: Stage; deals: OpportunityRecord[]; count: number; totals: Totals; limit: number };

function add(totals: Totals, currency: string, amount: bigint) {
  totals.set(currency, (totals.get(currency) ?? 0n) + amount);
}

export function summarize(rows: SummaryRow[]): PipelineSummary {
  const summary: PipelineSummary = { count: rows.length, totals: new Map(), stages: new Map() };
  for (const row of rows) {
    const amount = cents(String(row.expected_amount));
    const stage = summary.stages.get(row.stage_id) ?? { count: 0, totals: new Map() };
    stage.count++;
    add(stage.totals, row.currency, amount);
    summary.stages.set(row.stage_id, stage);
    add(summary.totals, row.currency, amount);
  }
  return summary;
}

// "stageId:limit,…" → limits. The parameter only widens a view, so malformed entries are ignored, not errors.
export function cardLimits(value: unknown) {
  const limits = new Map<string, number>();
  if (typeof value !== "string") return limits;
  for (const entry of value.split(",")) {
    const match = /^([0-9a-f-]{36}):(\d{1,4})$/i.exec(entry);
    if (match) limits.set(match[1].toLowerCase(), Math.min(BOARD_MAX, Math.max(BOARD_CARDS, Number(match[2]))));
  }
  return limits;
}

export function cardsParam(limits: Map<string, number>, stageId: string, limit: number) {
  return [...new Map(limits).set(stageId, limit)].map(([id, n]) => `${id}:${n}`).join(",");
}

// Stages in configured order. An inactive stage appears only while matching deals still use it, and a stage
// filter shows only that stage.
export function boardStages(stages: Stage[], summary: PipelineSummary, stageFilter = "") {
  return stages.filter(stage => summary.stages.has(stage.id) || (stage.active && !stageFilter));
}
