import Link from "next/link";
import type { Report, ReportOptions } from "@/features/reports/types";
import type { ReportFilters } from "@/features/reports/schemas";
import { reportPeriodLabel } from "@/features/reports/schemas";
import { cents, money, performance } from "@/features/finance/money";
import { activityTypeLabels, activityStatusLabels, workCategoryLabels } from "@/features/activities/schemas";
import { formatDate } from "@/lib/dates";
import { ReportBars } from "./bars";
import { ReportFiltersForm } from "./filters";
import { RefreshReport } from "./refresh-button";
const label = (key: string, labels: Record<string, string>) => labels[key] ?? key.replaceAll("_", " ");
const month = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${value}-01T00:00Z`));
function Cards({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([name, value]) => (
        <div key={name} className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-5">
          <h3 className="text-sm text-base-content/60">{name}</h3>
          <p className="mt-3 break-words text-xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
export function ReportView({
  view,
  filters,
  report: r,
  options,
}: {
  view: "dashboard" | "reports";
  filters: ReportFilters;
  report: Report;
  options: ReportOptions;
}) {
  const path = `/${view}`,
    currency = r.currency,
    funds = r.fundraising,
    p = r.pipeline,
    w = r.workload,
    monthly = filters.period.startsWith("m");
  const totals = funds.target === null ? null : performance(cents(funds.target), cents(funds.actual));
  const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)]));
  const stageBars = [...p.stages]
    .sort((a, b) =>
      cents(a.expected) === cents(b.expected)
        ? a.name.localeCompare(b.name)
        : cents(a.expected) > cents(b.expected)
          ? -1
          : 1,
    )
    .slice(0, 12);
  const targetLabel = funds.target_status === "draft" ? "Draft target" : "Assigned target";
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-base-content/60">
            {reportPeriodLabel(filters.period)} · {filters.year} · {currency}
          </p>
          <h1 className="text-3xl font-bold">{view === "dashboard" ? "PSE dashboard" : "Performance reports"}</h1>
          <p className="mt-2 text-sm text-base-content/65">
            Fundraising achievement and relationship workload, shown separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RefreshReport />
          <Link href={`/${view === "dashboard" ? "reports" : "dashboard"}?${query}`} className="btn btn-ghost btn-sm">
            {view === "dashboard" ? "Detailed reports" : "Dashboard overview"}
          </Link>
        </div>
      </div>
      <p className="mb-5 text-xs text-base-content/55">
        Updated {formatDate(r.generated_at, true)} · Asia/Dhaka · Snapshots may be up to 30 seconds old; Refresh data
        requests a new snapshot.
      </p>
      <ReportFiltersForm key={query.toString()} path={path} filters={filters} options={options} />
      <section aria-labelledby="fundraising-heading" className="space-y-5">
        <div>
          <h2 id="fundraising-heading" className="text-2xl font-bold">
            Monetary fundraising
          </h2>
          <p className="mt-2 text-sm text-base-content/65">
            Actuals use confirmed contributions recognized in the selected period and currency. Pipeline forecasts are
            shown in their own section.
          </p>
        </div>
        {funds.target_status === "draft" && (
          <p role="status" className="rounded-lg bg-warning/10 p-4 text-sm">
            This target plan is a draft. Targets are provisional until an authorized manager reviews and approves them.
          </p>
        )}
        {(monthly || funds.target === null) && (
          <p className="rounded-lg bg-base-200 p-4 text-sm">
            {monthly
              ? "Monthly targets have not been assigned. This view shows monthly actuals without dividing quarterly targets into invented monthly quotas."
              : "No target is assigned for this selection. Actual contributions remain visible; target attainment is unavailable."}
          </p>
        )}
        <Cards
          rows={[
            [targetLabel, funds.target === null ? "Not assigned" : money(funds.target, currency)],
            ["Actual achievement", money(funds.actual, currency)],
            ["Remaining", totals ? money(totals.remaining, currency) : "Not applicable"],
            ["Overachievement", totals ? money(totals.over, currency) : "Not applicable"],
          ]}
        />
        <div className="flex flex-wrap justify-between gap-3 text-sm">
          <p>
            Attainment:{" "}
            <strong>{totals?.percentage === null || !totals ? "Not applicable" : `${totals.percentage}%`}</strong> ·{" "}
            {funds.receipt_count} contribution records
          </p>
          {funds.plan_id && (
            <Link className="link" href={`/targets/${funds.plan_id}`}>
              View target plan
            </Link>
          )}
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ReportBars
            title="Actual cash and valued in-kind"
            rows={funds.types.map(t => ({
              label: t.key === "cash" ? "Cash" : "Valued in-kind",
              value: t.amount,
              display: money(t.amount, currency),
            }))}
          />
          <ReportBars
            title="Recognized achievement by month"
            rows={r.trends.map(t => ({ label: month(t.month), value: t.actual, display: money(t.actual, currency) }))}
          />
        </div>
        <p className="text-xs text-base-content/60">
          Unassigned-vertical actuals in this selection: {money(funds.unassigned_actual, currency)}. Overachievement
          remains in its original period; later quarter targets stay fixed.
        </p>
        {view === "reports" && (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table">
              <caption className="p-4 text-left font-semibold">Employee / vertical fundraising</caption>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Vertical</th>
                  <th>Target</th>
                  <th>Actual</th>
                  <th>Attainment</th>
                  <th>Remaining</th>
                  <th>Over</th>
                </tr>
              </thead>
              <tbody>
                {funds.dimensions.map(d => {
                  const row = d.target === null ? null : performance(cents(d.target), cents(d.actual));
                  return (
                    <tr key={`${d.employee_id}:${d.vertical_id ?? "unassigned"}`}>
                      <td>{d.employee_name}</td>
                      <td>{d.vertical_name}</td>
                      <td>{d.target === null ? "Not assigned" : money(d.target, currency)}</td>
                      <td>{money(d.actual, currency)}</td>
                      <td>{row?.percentage == null ? "Not applicable" : `${row.percentage}%`}</td>
                      <td>{row ? money(row.remaining, currency) : "—"}</td>
                      <td>{row ? money(row.over, currency) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!funds.dimensions.length && (
              <p className="p-5 text-sm text-base-content/60">No matching allocations or contributions.</p>
            )}
          </div>
        )}
      </section>
      <section aria-labelledby="pipeline-heading" className="mt-9 space-y-5">
        <div>
          <h2 id="pipeline-heading" className="text-2xl font-bold">
            Pipeline forecast
          </h2>
          <p className="mt-2 text-sm text-base-content/65">
            Current stages of opportunities expected to close in this period, filtered by owner and currency. Funding
            vertical has no pipeline mapping.
          </p>
        </div>
        <Cards
          rows={[
            ["Expected pipeline value", money(p.expected, currency)],
            ["Opportunities in period", String(p.count)],
            ["Missing closing date", String(p.undated_count)],
            ["Undated expected value", money(p.undated_expected, currency)],
          ]}
        />
        <ReportBars
          title={p.stages.length > 12 ? "Top 12 stages by expected value" : "Expected value by current stage"}
          rows={stageBars.map(s => ({
            label: `${s.name}${s.is_provisional ? " (provisional)" : ""}`,
            value: s.expected,
            display: `${money(s.expected, currency)} · ${s.count} deals`,
          }))}
        />
        <div className="flex flex-wrap gap-3">
          {p.outcomes.map(o => (
            <div key={o.key} className="rounded-lg bg-base-200 px-4 py-3 text-sm">
              <span className="capitalize">{o.key}</span>: <strong>{o.count}</strong>
              <p className="mt-1 text-xs text-base-content/60">{money(o.expected, currency)} expected</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-base-content/60">
          Undated opportunities are excluded from period totals. Stage outcomes are current classifications; Won is not
          a receipt or automatic achievement.
        </p>
        {view === "reports" && (
          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table">
              <caption className="p-4 text-left font-semibold">All matching stages</caption>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Outcome</th>
                  <th>Deals</th>
                  <th>Expected value</th>
                </tr>
              </thead>
              <tbody>
                {p.stages.map(s => (
                  <tr key={s.id}>
                    <td>
                      {s.name}
                      {s.is_provisional && <span className="ml-2 text-xs text-base-content/55">provisional</span>}
                    </td>
                    <td className="capitalize">{s.outcome}</td>
                    <td>{s.count}</td>
                    <td>{money(s.expected, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section aria-labelledby="workload-heading" className="mt-9 space-y-5">
        <div>
          <h2 id="workload-heading" className="text-2xl font-bold">
            Non-monetary work
          </h2>
          <p className="mt-2 text-sm text-base-content/65">
            Activity relevant dates and meeting scheduled dates determine the period. Owner filters apply; currency and
            funding vertical do not restrict these work records.
          </p>
        </div>
        <Cards
          rows={[
            ["Dated activity records", String(w.activity_count)],
            ["Completed activities", String(w.statuses.find(s => s.key === "done")?.count ?? 0)],
            ["Meeting records", String(w.meeting_count)],
            ["Done meetings", String(w.meeting_statuses.find(s => s.key === "done")?.count ?? 0)],
          ]}
        />
        <div className="grid gap-5 lg:grid-cols-2">
          <ReportBars
            title="Activities by type"
            rows={w.types.map(t => ({
              label: label(t.key, activityTypeLabels),
              value: String(t.count),
              display: String(t.count),
            }))}
          />
          <div className="space-y-5">
            <ReportBars
              title="Work categories"
              rows={w.categories.map(t => ({
                label: label(t.key, workCategoryLabels),
                value: String(t.count),
                display: String(t.count),
              }))}
            />
            <ReportBars
              title="Meeting status"
              rows={w.meeting_statuses.map(t => ({
                label: t.key[0].toUpperCase() + t.key.slice(1),
                value: String(t.count),
                display: String(t.count),
              }))}
            />
            <ReportBars
              title="Activity status"
              rows={w.statuses.map(t => ({
                label: label(t.key, activityStatusLabels),
                value: String(t.count),
                display: String(t.count),
              }))}
            />
          </div>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ReportBars
            title="Activity records by month"
            rows={r.trends.map(t => ({
              label: month(t.month),
              value: String(t.activities),
              display: String(t.activities),
            }))}
          />
          <ReportBars
            title="Meeting records by month"
            rows={r.trends.map(t => ({
              label: month(t.month),
              value: String(t.meetings),
              display: String(t.meetings),
            }))}
          />
        </div>
        <p className="text-xs leading-6 text-base-content/60">
          Independent activities in period: {w.independent_count}. Undated activities across all dates for this owner
          selection: {w.undated_activities} (excluded from period counts). Meeting-type activities and canonical
          meetings are separate record counts and are never added together as unique interactions.
        </p>
        {w.missing_context > 0 && (
          <p className="rounded-lg bg-warning/10 p-4 text-sm">
            {w.missing_context} older independent {w.missing_context === 1 ? "activity needs" : "activities need"} a
            related person or organization. Add context when editing these records.
          </p>
        )}
        {view === "reports" && (
          <>
            <div className="overflow-x-auto rounded-xl border border-base-300">
              <table className="table">
                <caption className="p-4 text-left font-semibold">Work by owner</caption>
                <thead>
                  <tr>
                    <th>Owner</th>
                    <th>Activities</th>
                    <th>Completed activities</th>
                    <th>Meetings</th>
                    <th>Done meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {w.owners.map(o => (
                    <tr key={o.id}>
                      <td>{o.name}</td>
                      <td>{o.activities}</td>
                      <td>{o.completed_activities}</td>
                      <td>{o.meetings}</td>
                      <td>{o.done_meetings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="overflow-x-auto rounded-xl border border-base-300">
              <table className="table">
                <caption className="p-4 text-left font-semibold">Monthly trends</caption>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Actual ({currency})</th>
                    <th>Activities</th>
                    <th>Completed activities</th>
                    <th>Meetings</th>
                    <th>Done meetings</th>
                  </tr>
                </thead>
                <tbody>
                  {r.trends.map(t => (
                    <tr key={t.month}>
                      <td>{t.month}</td>
                      <td>{money(t.actual, currency)}</td>
                      <td>{t.activities}</td>
                      <td>{t.completed_activities}</td>
                      <td>{t.meetings}</td>
                      <td>{t.done_meetings}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <details className="mt-8 rounded-xl border border-base-300 p-5">
        <summary className="cursor-pointer font-semibold">How these figures are defined</summary>
        <div className="mt-4 space-y-3 text-sm leading-6 text-base-content/70">
          <p>
            Periods are calendar dates in Asia/Dhaka, from {r.start_date} inclusive to {r.end_date_exclusive} exclusive.
            Financial achievement uses the saved recognition time and explicit employee/vertical attribution.
            Year/quarter targets use stored baselines or allocation cells for the selection. Monthly targets are
            unavailable. Missing targets stay unavailable; zero allocations are not treated as missing.
          </p>
          <p>
            Pipeline figures are expected values and current outcomes for saved expected closing dates in the period.
            They do not reconstruct historical stages or add operational budgets to funding. Unvalued gifts and activity
            estimates never count as fundraising.
          </p>
          <p>
            Workload uses activity relevant time and meeting scheduled time; Done is the current saved status, not a
            separately recorded completion date. Independent activities have no contact, opportunity or meeting link.
            Undated and missing-context counts span all dates for the selected owner, as labeled.
          </p>
          <p>
            Lead, contacts-engaged and follow-up-rate KPIs are awaiting approved definitions and are not calculated
            here. Existing record types and configurable labels are retained without declaring provisional stages or
            verticals final.
          </p>
        </div>
      </details>
    </>
  );
}
