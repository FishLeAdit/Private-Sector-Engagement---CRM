import { cents, decimal, percentAmount, percentHundredths, percentOf, splitAmount } from "@/lib/money";
import type { TargetInput } from "./schemas";

// The allocation grid behind the target form: each quarter is split across members by amount, and each
// member's amount across verticals by percentage (assessment p6, p9 steps 4–6). Only the resulting
// employee × vertical cell amounts are saved; percentages are always derived from them.

export type Allocation = TargetInput["allocations"][number];
// One member's quarter. `kept` holds the saved cells until the row is edited, so re-saving an untouched
// draft never re-rounds amounts that two-decimal percentages cannot represent exactly.
export type MemberSplit = { amount: string; shares: Record<string, string>; kept?: Allocation[] };
export type AllocationGrid = Record<number, Record<string, MemberSplit>>;

export const quarterNumbers = [1, 2, 3, 4];
const amountPattern = /^\d{1,12}(\.\d{1,2})?$/;

export function gridFromAllocations(allocations: Allocation[]): AllocationGrid {
  const grid: AllocationGrid = { 1: {}, 2: {}, 3: {}, 4: {} };
  for (const cell of allocations) {
    const row = (grid[cell.quarter][cell.employee_id] ??= { amount: "", shares: {}, kept: [] });
    row.kept!.push(cell);
  }
  for (const quarter of quarterNumbers)
    for (const row of Object.values(grid[quarter])) {
      row.amount = decimal(row.kept!.reduce((sum, cell) => sum + cents(cell.amount), 0n));
      for (const cell of row.kept!) row.shares[cell.vertical_id] = percentOf(cell.amount, row.amount);
    }
  return grid;
}

// Every vertical that has a saved share somewhere, so its column stays visible even when inactive.
export function usedVerticals(grid: AllocationGrid) {
  return new Set(quarterNumbers.flatMap(q => Object.values(grid[q]).flatMap(row => Object.keys(row.shares))));
}

// The members' amounts in a quarter; throws on an invalid entry.
export function allocatedToMembers(grid: AllocationGrid, quarter: number) {
  return Object.values(grid[quarter]).reduce(
    (sum, row) => sum + (row.amount.trim() ? cents(row.amount.trim()) : 0n),
    0n,
  );
}

// The row's split in hundredths of a percent (10000n = 100%), or null while an entry is invalid.
export function shareTotal(row: MemberSplit) {
  try {
    return Object.values(row.shares).reduce(
      (sum, share) => sum + (share.trim() ? percentHundredths(share.trim()) : 0n),
      0n,
    );
  } catch {
    return null;
  }
}

// The amount each vertical column will receive: the saved cells while untouched, the exact split once the
// percentages total 100, otherwise a rounded-down preview. Empty for a vertical with no share, or while
// nothing can be calculated yet.
export function cellAmounts(row: MemberSplit, verticalIds: string[]): string[] {
  if (row.kept)
    return verticalIds.map(id => {
      const cell = row.kept!.find(saved => saved.vertical_id === id);
      return cell ? decimal(cents(cell.amount)) : "";
    });
  const amount = row.amount.trim();
  if (!amountPattern.test(amount)) return verticalIds.map(() => "");
  const shares = verticalIds.map(id => row.shares[id]?.trim() || "0");
  const none = (share: string) => cents(share) === 0n;
  if (shareTotal(row) === 10000n)
    return splitAmount(amount, shares).map((part, index) => (none(shares[index]) ? "" : part));
  return shares.map(share => {
    try {
      return none(share) ? "" : percentAmount(amount, share);
    } catch {
      return "";
    }
  });
}

// Turns the grid into the saved cells, or explains what blocks saving. A member with an amount needs a
// split totalling exactly 100%, because every saved cell belongs to a vertical. Zero cells are dropped.
export function buildAllocations(grid: AllocationGrid, verticalIds: string[], name: (employeeId: string) => string) {
  const allocations: Allocation[] = [],
    problems: string[] = [];
  for (const quarter of quarterNumbers)
    for (const [employee, row] of Object.entries(grid[quarter])) {
      if (row.kept) {
        allocations.push(...row.kept);
        continue;
      }
      const label = `Q${quarter} · ${name(employee)}:`;
      const amount = row.amount.trim();
      if (!amount) {
        if (shareTotal(row) !== 0n) problems.push(`${label} enter the member's amount for this quarter.`);
        continue;
      }
      if (!amountPattern.test(amount)) {
        problems.push(`${label} enter an amount with at most two decimals.`);
        continue;
      }
      if (cents(amount) === 0n) continue;
      const total = shareTotal(row);
      if (total === null) problems.push(`${label} use vertical percentages from 0 to 100 with at most two decimals.`);
      else if (total !== 10000n)
        problems.push(
          `${label} the vertical split totals ${decimal(total).replace(/\.?0+$/, "")}%; it must total 100%.`,
        );
      else
        cellAmounts(row, verticalIds).forEach((part, index) => {
          // Blank means no share; a share can also round down to zero cents.
          if (part && cents(part) > 0n)
            allocations.push({ quarter, employee_id: employee, vertical_id: verticalIds[index], amount: part });
        });
    }
  return { allocations, problems };
}
