"use client";
import { useState } from "react";
import type { FinanceOptions } from "@/features/finance/types";
import {
  allocatedToMembers,
  cellAmounts,
  quarterNumbers,
  shareTotal,
  type AllocationGrid as Grid,
  type MemberSplit,
} from "@/features/targets/allocation-grid";
import { cents, decimal, formatCents } from "@/lib/money";

const percent = (hundredths: bigint) => `${decimal(hundredths).replace(/\.?0+$/, "")}%`;

// One quarter at a time: each member's amount, then that amount split across verticals by percentage.
// Inactive members and verticals appear only while a saved share still uses them.
export function AllocationGrid({
  grid,
  onChange,
  quarterTargets,
  currency,
  options,
  verticalIds,
}: {
  grid: Grid;
  onChange: (grid: Grid) => void;
  quarterTargets: Record<number, string>;
  currency: string;
  options: FinanceOptions;
  verticalIds: string[];
}) {
  const [quarter, setQuarter] = useState(1);
  const verticals = verticalIds.map(id => options.verticals.find(v => v.id === id)!);
  const members = options.employees.filter(e => e.active || grid[quarter][e.id]);
  const row = (employee: string): MemberSplit => grid[quarter][employee] ?? { amount: "", shares: {} };
  // Editing a row drops its kept cells: from then on its cells are recalculated from amount × percentage.
  const edit = (employee: string, change: Partial<MemberSplit>) =>
    onChange({
      ...grid,
      [quarter]: { ...grid[quarter], [employee]: { ...row(employee), ...change, kept: undefined } },
    });

  let summary: string;
  try {
    const target = cents(quarterTargets[quarter] || "0"),
      allocated = allocatedToMembers(grid, quarter);
    const left = target - allocated,
      format = (value: bigint) => formatCents(value, currency);
    summary = `Q${quarter} target ${format(target)} · allocated to members ${format(allocated)} · ${
      left < 0n ? `over-allocated by ${format(-left)}` : `left to allocate ${format(left)}`
    }`;
  } catch {
    summary = `Q${quarter}: enter valid amounts to see what is left to allocate.`;
  }

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Quarter" className="join">
        {quarterNumbers.map(q => (
          <button
            key={q}
            type="button"
            aria-pressed={q === quarter}
            className={`btn btn-sm join-item ${q === quarter ? "btn-primary" : "btn-outline"}`}
            onClick={() => setQuarter(q)}
          >
            Q{q}
          </button>
        ))}
      </div>
      <p className="text-sm" aria-live="polite">
        {summary}
      </p>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Member</th>
              <th>Quarter amount</th>
              {verticals.map(v => (
                <th key={v.id}>
                  {v.name} %{!v.active && " (inactive)"}
                </th>
              ))}
              <th>Split</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const split = row(member.id),
                total = shareTotal(split),
                amounts = cellAmounts(split, verticalIds),
                name = member.display_name;
              return (
                <tr key={member.id}>
                  <th scope="row">
                    {name}
                    {!member.active && " (inactive)"}
                  </th>
                  <td>
                    <input
                      aria-label={`Q${quarter} ${name} amount`}
                      inputMode="decimal"
                      className="input input-bordered input-sm w-36"
                      value={split.amount}
                      onChange={e => edit(member.id, { amount: e.target.value })}
                    />
                  </td>
                  {verticals.map((v, index) => {
                    const amountId = `allocation-q${quarter}-${member.id}-${v.id}`;
                    return (
                      <td key={v.id}>
                        <input
                          aria-label={`Q${quarter} ${name} ${v.name} %`}
                          aria-describedby={amountId}
                          inputMode="decimal"
                          className="input input-bordered input-sm w-20"
                          value={split.shares[v.id] ?? ""}
                          onChange={e => edit(member.id, { shares: { ...split.shares, [v.id]: e.target.value } })}
                        />
                        <span id={amountId} className="mt-1 block text-xs text-base-content/60">
                          {amounts[index] || "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-xs">
                    {total === null ? (
                      <span role="alert" className="text-error">
                        Use 0–100, at most two decimals
                      </span>
                    ) : total === 10000n ? (
                      "100%"
                    ) : total === 0n ? (
                      "—"
                    ) : (
                      <span className="text-warning">
                        {percent(total)} (
                        {total < 10000n ? `${percent(10000n - total)} left` : `${percent(total - 10000n)} over`})
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
