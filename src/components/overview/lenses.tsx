import Link from "next/link";
import type { OverviewData } from "@/features/overview/context";
import type { CountMetric } from "@/features/reports/types";
import { cents, money, targetPerformance } from "@/lib/money";
import { TapeMeter } from "@/components/charts/tape-meter";
import { MonthReceiptsFigure, PaceFigure } from "@/components/reports/fundraising-charts";
import { StageFigure } from "@/components/reports/pipeline-section";
import { SectionHeader } from "@/components/reports/section-header";
import { StatCards } from "@/components/reports/stat-cards";
import {
  activityTypeLabel,
  CountChart,
  meetingStatusLabel,
  WorkMonthFigure,
} from "@/components/reports/workload-charts";
import { Readout, StatusPip } from "@/components/ui/hud";

// A large amount with its currency as a small unit beside it, as instruments label units, so the figure
// stays on one line.
function Figure({ amount, currency }: { amount: string; currency: string }) {
  const [unit, value] = money(amount, currency).split(" ");
  return (
    <>
      <span className="mr-1 align-baseline font-mono text-base font-medium text-muted">{unit}</span> {value}
    </>
  );
}

// Monetary fundraising: the one hero figure, its pace, and the pipeline behind it. Forecasts stay forecasts.
export function MonetaryLens({ data }: { data: OverviewData }) {
  const { report, quarters } = data;
  const { currency, fundraising: f, pipeline: p } = report;
  const totals = f.target === null ? null : targetPerformance(cents(f.target), cents(f.actual));
  const won = p.outcomes.find(o => o.key === "won");
  return (
    <section aria-labelledby="monetary-heading" className="space-y-5">
      <SectionHeader id="monetary-heading" index="01" code="FIN-01" title="Monetary fundraising">
        Confirmed contributions against the team target; pipeline values are forecasts, shown separately.
      </SectionHeader>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="panel flex flex-col gap-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <Readout size="hero" label="Actual achievement" value={<Figure amount={f.actual} currency={currency} />} />
            {f.target_status === "draft" && <StatusPip tone="warning" label="Draft target" />}
          </div>
          <div>
            <TapeMeter actual={f.actual} target={f.target} />
            <p className="mt-2 text-xs text-muted">
              {f.target === null
                ? "No target is assigned for this period."
                : `${totals?.percentage}% of the ${money(f.target, currency)} target`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-base-300 pt-4">
            <Readout label="Remaining" value={totals ? money(totals.remaining, currency) : "Not applicable"} />
            <Readout label="Overachievement" value={totals ? money(totals.over, currency) : "Not applicable"} />
          </div>
          {f.plan_id && (
            <Link className="link font-mono text-xs uppercase tracking-wider" href={`/targets/${f.plan_id}`}>
              View target plan
            </Link>
          )}
        </div>
        {quarters ? <PaceFigure quarters={quarters} currency={currency} /> : <MonthReceiptsFigure report={report} />}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <StageFigure report={report} />
        <div className="panel grid content-start gap-5 p-6 sm:grid-cols-2">
          <Readout
            label="Pipeline expected"
            value={money(p.expected, currency)}
            detail={`${p.count} deals in period`}
          />
          <Readout
            label="Won, expected value"
            value={money(won?.expected ?? "0", currency)}
            detail={`${won?.count ?? 0} won deals; a stage is not a receipt`}
          />
          {f.types.map(t => (
            <Readout
              key={t.key}
              label={t.key === "cash" ? "Cash received" : "Valued in-kind"}
              value={money(t.amount, currency)}
              detail={`${t.count} records`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const done = (metrics: CountMetric[]) => String(metrics.find(m => m.key === "done")?.count ?? 0);

// Non-monetary work: volume over time, what kind of work, and the people reached.
export function WorkLens({ data }: { data: OverviewData }) {
  const { report } = data;
  const { workload: w, engagement: e } = report;
  return (
    <section aria-labelledby="work-heading" className="mt-10 space-y-5">
      <SectionHeader id="work-heading" index="02" code="ACT-01" title="Non-monetary work">
        Activities and meetings in the period, and the contacts they reached. None of it counts as fundraising.
      </SectionHeader>
      <StatCards
        rows={[
          ["Dated activity records", String(w.activity_count)],
          ["Completed activities", done(w.statuses)],
          ["Meeting records", String(w.meeting_count)],
          ["Done meetings", done(w.meeting_statuses)],
        ]}
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <WorkMonthFigure report={report} kind="activities" />
        <CountChart
          title="Top activity types"
          code="ACT-T"
          metrics={w.types}
          label={activityTypeLabel}
          sorted
          limit={5}
        />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <CountChart
          title="Meeting status"
          code="MTG-S"
          metrics={w.meeting_statuses}
          label={meetingStatusLabel}
          highlight="done"
        />
        {e && (
          <section aria-labelledby="engaged-heading" className="panel space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h3 id="engaged-heading" className="font-mono text-xs font-semibold">
                Contacts engaged
              </h3>
              <StatusPip tone="warning" label="Provisional — awaiting PSE definition" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Readout label="Contacts" value={String(e.contacts)} />
              <Readout label="Individuals" value={String(e.individuals)} />
              <Readout label="Companies" value={String(e.companies)} />
            </div>
            <p className="text-xs text-muted">
              Distinct CRM contacts reached by Done meetings and Done activities; {e.unlinked_named} named but unlinked
              interactions are counted separately.
            </p>
          </section>
        )}
      </div>
    </section>
  );
}
