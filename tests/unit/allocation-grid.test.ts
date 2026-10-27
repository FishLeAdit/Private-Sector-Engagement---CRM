import { describe, expect, it } from "vitest";
import {
  allocatedToMembers,
  buildAllocations,
  cellAmounts,
  gridFromAllocations,
  shareTotal,
  type Allocation,
} from "../../src/features/targets/allocation-grid";
import { splitAmount } from "../../src/lib/money";

const memberA = "00000000-0000-4000-8000-000000000002",
  memberB = "00000000-0000-4000-8000-000000000003",
  dsp = "50000000-0000-4000-8000-000000000001",
  vbd = "50000000-0000-4000-8000-000000000002",
  project = "50000000-0000-4000-8000-000000000003",
  verticals = [dsp, vbd, project];
const name = (id: string) => (id === memberA ? "Member A" : "Member B");

// The approved plan in supabase/seed.sql: each quarter is Member A/DSP 50%, Member B/VBD 20%, Member B/Project 30%.
const seeded: Allocation[] = [
  { quarter: 1, employee_id: memberA, vertical_id: dsp, amount: "75000.00" },
  { quarter: 1, employee_id: memberB, vertical_id: vbd, amount: "30000.00" },
  { quarter: 1, employee_id: memberB, vertical_id: project, amount: "45000.00" },
];

describe("splitting an amount by percentage", () => {
  it("rounds each part down and gives the leftover cents to the last nonzero share", () => {
    expect(splitAmount("10.00", ["33.33", "33.33", "33.34"])).toEqual(["3.33", "3.33", "3.34"]);
    expect(splitAmount("0.05", ["50", "50", "0"])).toEqual(["0.02", "0.03", "0.00"]);
    // The largest supported amount stays exact: 999,899,999,999.99 plus the one leftover cent.
    expect(splitAmount("999999999999.99", ["0.01", "99.99"])).toEqual(["99999999.99", "999900000000.00"]);
  });
  it("refuses percentages that are invalid or do not total exactly 100", () => {
    expect(() => splitAmount("100", ["50", "49.99"])).toThrow(/total 100/);
    expect(() => splitAmount("100", ["100.01", "0"])).toThrow(/0 to 100/);
    expect(() => splitAmount("100", ["12.345", "87.655"])).toThrow(/two decimals/);
  });
});

describe("the member and vertical grid", () => {
  it("reads a saved plan as member amounts and vertical percentages", () => {
    const grid = gridFromAllocations(seeded);
    expect(grid[1][memberA]).toMatchObject({ amount: "75000.00", shares: { [dsp]: "100" } });
    expect(grid[1][memberB]).toMatchObject({ amount: "75000.00", shares: { [vbd]: "40", [project]: "60" } });
    expect(allocatedToMembers(grid, 1)).toBe(15000000n);
    expect(grid[2]).toEqual({});
  });
  it("returns an untouched plan's cells unchanged, and the same cells after recalculating them", () => {
    const grid = gridFromAllocations(seeded);
    expect(buildAllocations(grid, verticals, name)).toEqual({ allocations: seeded, problems: [] });
    const edited = { ...grid, 1: { ...grid[1], [memberB]: { ...grid[1][memberB], kept: undefined } } };
    expect(buildAllocations(edited, verticals, name).allocations).toEqual(seeded);
  });
  it("previews rounded-down amounts until a split totals 100%, then the exact split", () => {
    const row = { amount: "0.05", shares: { [dsp]: "50" } };
    expect(shareTotal(row)).toBe(5000n);
    expect(cellAmounts(row, verticals)).toEqual(["0.02", "", ""]);
    expect(cellAmounts({ ...row, shares: { [dsp]: "50", [vbd]: "50" } }, verticals)).toEqual(["0.02", "0.03", ""]);
  });
  it("explains each problem that blocks saving, and skips members with no amount", () => {
    const grid = gridFromAllocations([]);
    grid[1][memberA] = { amount: "100", shares: { [dsp]: "90" } };
    grid[2][memberA] = { amount: "1.234", shares: { [dsp]: "100" } };
    grid[3][memberB] = { amount: "", shares: { [vbd]: "100" } };
    grid[4][memberA] = { amount: "100", shares: { [dsp]: "abc" } };
    grid[4][memberB] = { amount: "0", shares: {} };
    expect(buildAllocations(grid, verticals, name)).toEqual({
      allocations: [],
      problems: [
        "Q1 · Member A: the vertical split totals 90%; it must total 100%.",
        "Q2 · Member A: enter an amount with at most two decimals.",
        "Q3 · Member B: enter the member's amount for this quarter.",
        "Q4 · Member A: use vertical percentages from 0 to 100 with at most two decimals.",
      ],
    });
  });
  it("drops zero cells, so a 0% vertical stores nothing", () => {
    const grid = gridFromAllocations([]);
    grid[1][memberA] = { amount: "500", shares: { [dsp]: "100", [vbd]: "0" } };
    expect(buildAllocations(grid, verticals, name).allocations).toEqual([
      { quarter: 1, employee_id: memberA, vertical_id: dsp, amount: "500.00" },
    ]);
  });
});
