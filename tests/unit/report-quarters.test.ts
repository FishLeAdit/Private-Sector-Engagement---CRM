import { describe, expect, it } from "vitest";
import { cumulative, quarterSeries, type PlanBreakdown } from "../../src/features/reports/quarters";
import { reportFixture } from "../helpers/report-fixture";

const member = "00000000-0000-4000-8000-000000000002",
  colleague = "00000000-0000-4000-8000-000000000003",
  dsp = "50000000-0000-4000-8000-000000000001",
  vbd = "50000000-0000-4000-8000-000000000002";
const plan: PlanBreakdown = {
  quarters: [
    { quarter: 1, amount: "150000" },
    { quarter: 2, amount: "250000" },
    { quarter: 3, amount: "250000" },
    { quarter: 4, amount: "350000" },
  ],
  allocations: [
    { quarter: 1, employee_id: member, vertical_id: dsp, amount: "75000" },
    { quarter: 1, employee_id: colleague, vertical_id: vbd, amount: "75000" },
    { quarter: 2, employee_id: member, vertical_id: dsp, amount: "125000" },
  ],
};
const filters = { year: 2026, period: "year" as const, employee_id: "", vertical_id: "", currency: "BDT" };
// Twelve months of actuals: 10 a month, plus 100 in March.
const report = () => {
  const r = reportFixture();
  r.trends = Array.from({ length: 12 }, (_, i) => ({
    month: `2026-${String(i + 1).padStart(2, "0")}`,
    actual: i === 2 ? "110" : "10",
    activities: 0,
    completed_activities: 0,
    meetings: 0,
    done_meetings: 0,
  }));
  return r;
};

describe("quarter targets and actuals for a full-year report", () => {
  it("uses the quarter baselines for the whole team and stops actuals at the current quarter", () => {
    expect(quarterSeries(report(), plan, filters, "2026-05-10T09:00")).toEqual([
      { quarter: 1, target: "150000.00", actual: "130.00" },
      { quarter: 2, target: "250000.00", actual: "30.00" },
      { quarter: 3, target: "250000.00", actual: null },
      { quarter: 4, target: "350000.00", actual: null },
    ]);
  });
  it("sums the matching cells for an employee or vertical, and has no target for unassigned receipts", () => {
    const targets = (extra: Partial<typeof filters>) =>
      quarterSeries(report(), plan, { ...filters, ...extra }, "2027-01-01")!.map(p => p.target);
    expect(targets({ employee_id: member })).toEqual(["75000.00", "125000.00", null, null]);
    expect(targets({ vertical_id: vbd })).toEqual(["75000.00", null, null, null]);
    expect(targets({ employee_id: member, vertical_id: vbd })).toEqual([null, null, null, null]);
    expect(targets({ vertical_id: "unassigned" })).toEqual([null, null, null, null]);
  });
  it("shows every quarter of a past year, none of a future one, and nothing outside full-year views", () => {
    expect(quarterSeries(report(), plan, filters, "2030-01-01")!.every(p => p.actual !== null)).toBe(true);
    expect(quarterSeries(report(), plan, filters, "2025-12-31")!.every(p => p.actual === null)).toBe(true);
    expect(quarterSeries(report(), plan, { ...filters, period: "q1" }, "2026-05-10")).toBeNull();
    expect(quarterSeries(report(), null, filters, "2026-05-10")!.every(p => p.target === null)).toBe(true);
  });
  it("accumulates totals and stops a series at its first missing quarter", () => {
    expect(
      cumulative([
        { quarter: 1, target: "100.00", actual: "120.00" },
        { quarter: 2, target: "200.00", actual: "50.00" },
        { quarter: 3, target: null, actual: null },
        { quarter: 4, target: "100.00", actual: "10.00" },
      ]),
    ).toEqual([
      { quarter: 1, target: "100.00", actual: "120.00" },
      { quarter: 2, target: "300.00", actual: "170.00" },
      { quarter: 3, target: null, actual: null },
      { quarter: 4, target: null, actual: null },
    ]);
  });
});
