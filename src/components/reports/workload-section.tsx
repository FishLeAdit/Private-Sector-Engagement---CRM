import type { CountMetric, Report } from "@/features/reports/types";
import { activityTypeLabels, activityStatusLabels, workCategoryLabels } from "@/features/activities/schemas";
import { money } from "@/lib/money";
import { ReportBars } from "./bars";
import { labelFor, monthLabel } from "./format";
import { StatCards } from "./stat-cards";

const countBars = (metrics: CountMetric[], label: (key: string) => string) =>
  metrics.map(m => ({ label: label(m.key), value: String(m.count), display: String(m.count) }));

const capitalize = (key: string) => key[0].toUpperCase() + key.slice(1);

// Activity and meeting record counts. Currency and funding vertical never filter this section.
export function WorkloadSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const { workload: w, trends } = report;
  const done = (metrics: CountMetric[]) => String(metrics.find(s => s.key === "done")?.count ?? 0);
  return (
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
      <StatCards
        rows={[
          ["Dated activity records", String(w.activity_count)],
          ["Completed activities", done(w.statuses)],
          ["Meeting records", String(w.meeting_count)],
          ["Done meetings", done(w.meeting_statuses)],
        ]}
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportBars title="Activities by type" rows={countBars(w.types, key => labelFor(key, activityTypeLabels))} />
        <div className="space-y-5">
          <ReportBars
            title="Work categories"
            rows={countBars(w.categories, key => labelFor(key, workCategoryLabels))}
          />
          <ReportBars title="Meeting status" rows={countBars(w.meeting_statuses, capitalize)} />
          <ReportBars
            title="Activity status"
            rows={countBars(w.statuses, key => labelFor(key, activityStatusLabels))}
          />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <ReportBars
          title="Activity records by month"
          rows={trends.map(t => ({
            label: monthLabel(t.month),
            value: String(t.activities),
            display: String(t.activities),
          }))}
        />
        <ReportBars
          title="Meeting records by month"
          rows={trends.map(t => ({
            label: monthLabel(t.month),
            value: String(t.meetings),
            display: String(t.meetings),
          }))}
        />
      </div>
      <p className="text-xs leading-6 text-base-content/60">
        Independent activities in period: {w.independent_count}. Undated activities across all dates for this owner
        selection: {w.undated_activities} (excluded from period counts). Meeting-type activities and canonical meetings
        are separate record counts and are never added together as unique interactions.
      </p>
      {w.missing_context > 0 && (
        <p className="rounded-lg bg-warning/10 p-4 text-sm">
          {w.missing_context} older independent {w.missing_context === 1 ? "activity needs" : "activities need"} a
          related person or organization. Add context when editing these records.
        </p>
      )}
      {detailed && (
        <>
          <OwnerTable owners={w.owners} />
          <TrendTable trends={trends} currency={report.currency} />
        </>
      )}
    </section>
  );
}

function OwnerTable({ owners }: { owners: Report["workload"]["owners"] }) {
  return (
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
          {owners.map(o => (
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
  );
}

// Each column is a separate measure; they are never summed into one workload total.
function TrendTable({ trends, currency }: { trends: Report["trends"]; currency: string }) {
  return (
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
          {trends.map(t => (
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
  );
}
