import Link from "next/link";
import type { ReportFilters } from "@/features/reports/schemas";
import { reportPeriods, reportPeriodLabel } from "@/features/reports/schemas";
import type { ReportOptions } from "@/features/reports/types";
export function ReportFiltersForm({
  filters,
  options,
  path,
}: {
  filters: ReportFilters;
  options: ReportOptions;
  path: string;
}) {
  return (
    <form action={path} className="panel mb-6 space-y-4 p-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="hud-label block">
          Year
          <input
            name="year"
            type="number"
            min={1}
            max={9998}
            defaultValue={filters.year}
            className="input input-bordered mt-2 w-full"
          />
        </label>
        <label className="hud-label block">
          Period
          <select name="period" defaultValue={filters.period} className="select select-bordered mt-2 w-full">
            <option value="year">Full year</option>
            <optgroup label="Quarters">
              {reportPeriods
                .filter(p => p.startsWith("q"))
                .map(p => (
                  <option key={p} value={p}>
                    {reportPeriodLabel(p)}
                  </option>
                ))}
            </optgroup>
            <optgroup label="Months">
              {reportPeriods
                .filter(p => p.startsWith("m"))
                .map(p => (
                  <option key={p} value={p}>
                    {reportPeriodLabel(p)}
                  </option>
                ))}
            </optgroup>
          </select>
        </label>
        <label className="hud-label block">
          PSE team member
          <select name="employee_id" defaultValue={filters.employee_id} className="select select-bordered mt-2 w-full">
            <option value="">Whole team</option>
            {filters.employee_id && !options.employees.some(e => e.id === filters.employee_id) && (
              <option value={filters.employee_id}>Selected historical employee</option>
            )}
            {options.employees.map(e => (
              <option key={e.id} value={e.id}>
                {e.display_name}
                {!e.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="hud-label block">
          Funding vertical
          <select name="vertical_id" defaultValue={filters.vertical_id} className="select select-bordered mt-2 w-full">
            <option value="">All verticals</option>
            <option value="unassigned">Unassigned contributions</option>
            {filters.vertical_id &&
              filters.vertical_id !== "unassigned" &&
              !options.verticals.some(v => v.id === filters.vertical_id) && (
                <option value={filters.vertical_id}>Selected historical vertical</option>
              )}
            {options.verticals.map(v => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.is_provisional ? " (provisional)" : ""}
                {!v.active ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="hud-label block">
          Funding currency
          <input
            name="currency"
            maxLength={3}
            defaultValue={filters.currency}
            className="input input-bordered mt-2 w-full"
          />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary btn-sm">Apply filters</button>
        <Link href={path} className="btn btn-ghost btn-sm">
          Reset
        </Link>
      </div>
      <p className="text-xs leading-5 text-base-content/60">
        Employee filters use contribution attribution and record ownership. Vertical filters apply to targets and
        contributions. Currency filters apply to contributions and pipeline values; workload counts stay independent of
        funding dimensions.
      </p>
    </form>
  );
}
