"use client";
import type { FinanceOptions } from "@/features/finance/types";
import type { TargetInput } from "@/features/targets/schemas";

type Allocation = TargetInput["allocations"][number];

// One employee × vertical cell for a quarter. The amount is what gets saved; the percentage box shows
// that amount's share of the quarter target, and typing a percentage updates the amount immediately.
export function AllocationRow({
  index,
  allocation,
  options,
  percentage,
  percentageError,
  onChange,
  onPercentageChange,
  onPercentageBlur,
  onRemove,
}: {
  index: number;
  allocation: Allocation;
  options: FinanceOptions;
  percentage: string;
  percentageError: string;
  onChange: (values: Partial<Allocation>) => void;
  onPercentageChange: (value: string) => void;
  onPercentageBlur: () => void;
  onRemove: () => void;
}) {
  const label = (part: string) => `Allocation ${index + 1} ${part}`;
  const errorId = `allocation-${index + 1}-percentage-error`;
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
          aria-invalid={!!percentageError}
          aria-describedby={percentageError ? errorId : undefined}
          onChange={e => onPercentageChange(e.target.value)}
          onBlur={onPercentageBlur}
        />
        {percentageError && (
          <span id={errorId} role="alert" className="mt-1 block text-error">
            {percentageError}
          </span>
        )}
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
