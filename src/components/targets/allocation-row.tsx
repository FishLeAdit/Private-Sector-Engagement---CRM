"use client";
import type { FinanceOptions } from "@/features/finance/types";
import type { TargetInput } from "@/features/targets/schemas";

type Allocation = TargetInput["allocations"][number];

// One employee × vertical cell for a quarter. The percentage box only calculates an amount when
// "Apply percentage" is pressed; the stored amount is the source of truth.
export function AllocationRow({
  index,
  allocation,
  options,
  percentage,
  onChange,
  onPercentageChange,
  onApplyPercentage,
  onRemove,
}: {
  index: number;
  allocation: Allocation;
  options: FinanceOptions;
  percentage: string;
  onChange: (values: Partial<Allocation>) => void;
  onPercentageChange: (value: string) => void;
  onApplyPercentage: () => void;
  onRemove: () => void;
}) {
  const label = (part: string) => `Allocation ${index + 1} ${part}`;
  return (
    <div className="grid gap-3 rounded-lg bg-base-200 p-4 sm:grid-cols-3 lg:grid-cols-6">
      <label className="text-xs">
        Quarter
        <select
          aria-label={label("quarter")}
          value={allocation.quarter}
          className="select select-bordered mt-1 w-full"
          onChange={e => onChange({ quarter: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map(q => (
            <option key={q} value={q}>
              Q{q}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Employee
        <select
          aria-label={label("employee")}
          value={allocation.employee_id}
          className="select select-bordered mt-1 w-full"
          onChange={e => onChange({ employee_id: e.target.value })}
        >
          <option value="">Choose…</option>
          {options.employees.map(e => (
            <option key={e.id} value={e.id} disabled={!e.active}>
              {e.display_name}
              {!e.active ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        Vertical
        <select
          aria-label={label("vertical")}
          value={allocation.vertical_id}
          className="select select-bordered mt-1 w-full"
          onChange={e => onChange({ vertical_id: e.target.value })}
        >
          <option value="">Choose…</option>
          {options.verticals.map(v => (
            <option key={v.id} value={v.id} disabled={!v.active}>
              {v.name}
              {v.is_provisional ? " (provisional)" : ""}
              {!v.active ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        % of quarter
        <input
          aria-label={label("percentage")}
          inputMode="decimal"
          className="input input-bordered mt-1 w-full"
          value={percentage}
          onChange={e => onPercentageChange(e.target.value)}
        />
        <button type="button" className="btn btn-ghost btn-xs mt-1" onClick={onApplyPercentage}>
          Apply percentage
        </button>
      </label>
      <label className="text-xs">
        Amount
        <input
          aria-label={label("amount")}
          inputMode="decimal"
          className="input input-bordered mt-1 w-full"
          value={allocation.amount}
          onChange={e => onChange({ amount: e.target.value })}
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost btn-sm self-center"
        aria-label={`Remove allocation ${index + 1}`}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  );
}
