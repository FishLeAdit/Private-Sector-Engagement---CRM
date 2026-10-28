import type { CountMetric, Report } from "@/features/reports/types";
import { money } from "@/lib/money";
import { Notice } from "@/components/ui/hud";
import { SectionHeader } from "./section-header";
import { StatCards } from "./stat-cards";
import { WorkloadCharts } from "./workload-charts";

// Activity and meeting record counts. Currency and funding vertical never filter this section.
export function WorkloadSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const { workload: w, trends } = report;
  const done = (metrics: CountMetric[]) => String(metrics.find(s => s.key === "done")?.count ?? 0);
  return (
    <section id="workload" aria-labelledby="workload-heading" className="mt-10 scroll-mt-16 space-y-5">
      <SectionHeader id="workload-heading" index="03" code="ACT-01" title="Non-monetary work">
        Activity relevant dates and meeting scheduled dates determine the period. Owner filters apply; currency and
        funding vertical do not restrict these work records.
      </SectionHeader>
      <StatCards
        rows={[
          ["Dated activity records", String(w.activity_count)],
          ["Completed activities", done(w.statuses)],
          ["Meeting records", String(w.meeting_count)],
          ["Done meetings", done(w.meeting_statuses)],
        ]}
      />
      <WorkloadCharts report={report} />
      <p className="text-xs leading-6 text-muted">
        Independent activities in period: {w.independent_count}. Undated activities across all dates for this owner
        selection: {w.undated_activities} (excluded from period counts). Meeting-type activities and canonical meetings
        are separate record counts and are never added together as unique interactions.
      </p>
      {w.missing_context > 0 && (
        <Notice tone="warning">
          {w.missing_context} older independent {w.missing_context === 1 ? "activity needs" : "activities need"} a
          related person or organization. Add context when editing these records.
        </Notice>
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
    <div className="panel overflow-x-auto p-0">
      <table className="table">
        <caption className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]">
          Work by owner
        </caption>
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
    <div className="panel overflow-x-auto p-0">
      <table className="table">
        <caption className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]">
          Monthly trends
        </caption>
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
