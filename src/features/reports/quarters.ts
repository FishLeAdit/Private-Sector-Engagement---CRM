import { cents, decimal } from "@/lib/money";
import type { ReportFilters } from "./schemas";
import type { Report } from "./types";

// Quarter targets and actuals for a full-year report, for the quarter and pace charts. Targets follow the
// report's own rule: the stored quarter baselines for the whole team and all verticals, otherwise the sum of
// the matching allocation cells, and none for unassigned receipts. Quarters still ahead have no actual yet.

export type PlanBreakdown = {
  quarters: { quarter: number; amount: string }[];
  allocations: { quarter: number; employee_id: string; vertical_id: string; amount: string }[];
};
export type QuarterPoint = { quarter: number; target: string | null; actual: string | null };

// The last month (1–12) with actuals to show: all of a past year, none of a future one.
function lastReportedMonth(year: number, today: string) {
  const [currentYear, currentMonth] = [Number(today.slice(0, 4)), Number(today.slice(5, 7))];
  return year < currentYear ? 12 : year > currentYear ? 0 : currentMonth;
}

export function quarterSeries(
  report: Report,
  plan: PlanBreakdown | null,
  filters: ReportFilters,
  today: string, // Asia/Dhaka "YYYY-MM-DD…"
): QuarterPoint[] | null {
  if (filters.period !== "year") return null;
  const reported = lastReportedMonth(filters.year, today);
  const wholeTeam = !filters.employee_id && !filters.vertical_id;
  return [1, 2, 3, 4].map(quarter => {
    const months = report.trends.filter(t => Math.ceil(Number(t.month.slice(5, 7)) / 3) === quarter);
    const started = (quarter - 1) * 3 + 1 <= reported;
    const actual = started ? decimal(months.reduce((sum, t) => sum + cents(t.actual), 0n)) : null;
    let target: string | null = null;
    if (plan && wholeTeam) target = plan.quarters.find(q => q.quarter === quarter)?.amount ?? null;
    else if (plan && filters.vertical_id !== "unassigned") {
      const cells = plan.allocations.filter(
        a =>
          a.quarter === quarter &&
          (!filters.employee_id || a.employee_id === filters.employee_id) &&
          (!filters.vertical_id || a.vertical_id === filters.vertical_id),
      );
      if (cells.length) target = decimal(cells.reduce((sum, a) => sum + cents(a.amount), 0n));
    }
    return { quarter, target: target === null ? null : decimal(cents(target)), actual };
  });
}

// Running totals for the pace chart; a series stops at its first missing quarter.
export function cumulative(points: QuarterPoint[]) {
  let target: bigint | null = 0n,
    actual: bigint | null = 0n;
  return points.map(p => {
    target = target === null || p.target === null ? null : target + cents(p.target);
    actual = actual === null || p.actual === null ? null : actual + cents(p.actual);
    return {
      quarter: p.quarter,
      target: target === null ? null : decimal(target),
      actual: actual === null ? null : decimal(actual),
    };
  });
}
