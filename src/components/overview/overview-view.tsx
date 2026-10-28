import Link from "next/link";
import type { OverviewData } from "@/features/overview/context";
import { reportPeriods, reportPeriodLabel } from "@/features/reports/schemas";
import { formatDate } from "@/lib/dates";
import { RefreshReport } from "@/components/reports/refresh-button";
import { SectionHeader } from "@/components/reports/section-header";
import { DataBlock, PanelHeader, StatusPip } from "@/components/ui/hud";
import { MonetaryLens, WorkLens } from "./lenses";
import { OverviewQueue } from "./queue";

// The home dashboard: status strip, the two performance lenses (assessment p10), then the user's queue.
export function OverviewView({ data }: { data: OverviewData }) {
  const { filters, report } = data;
  const query = new URLSearchParams({
    year: String(filters.year),
    period: filters.period,
    currency: filters.currency,
  }).toString();
  const period = filters.period === "year" ? "FY" : filters.period.toUpperCase();
  return (
    <>
      <div className="mb-6">
        <PanelHeader level={1} code={`SYS.OVR // ${period}-${filters.year} · ${report.currency}`} title="PSE overview">
          <RefreshReport />
          <Link href={`/reports?${query}`} className="btn btn-ghost btn-sm">
            Detailed reports
          </Link>
        </PanelHeader>
        <p className="text-sm text-muted">
          {reportPeriodLabel(filters.period)} · {filters.year} · {report.currency} · The whole PSE team, with your own
          queue at the end.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
          <StatusPip tone="nominal" label={`Updated ${formatDate(report.generated_at, true)}`} />
          <DataBlock
            items={[
              ["Contacts", data.contactCount.ok ? data.contactCount.data : "—"],
              ["Deals in period", report.pipeline.count],
              ["Meetings", report.workload.meeting_count],
              ["Activities", report.workload.activity_count],
              ["Receipts", report.fundraising.receipt_count],
            ]}
          />
        </div>
      </div>
      <form action="/dashboard" className="panel mb-8 flex flex-wrap items-end gap-4 p-4">
        <label className="hud-label">
          Year
          <input
            name="year"
            type="number"
            min={1}
            max={9998}
            defaultValue={filters.year}
            className="input input-bordered input-sm mt-1 block w-28"
          />
        </label>
        <label className="hud-label">
          Period
          <select name="period" defaultValue={filters.period} className="select select-bordered select-sm mt-1 block">
            {reportPeriods.map(p => (
              <option key={p} value={p}>
                {reportPeriodLabel(p)}
              </option>
            ))}
          </select>
        </label>
        <label className="hud-label">
          Currency
          <input
            name="currency"
            maxLength={3}
            defaultValue={filters.currency}
            className="input input-bordered input-sm mt-1 block w-24 uppercase"
          />
        </label>
        <button className="btn btn-primary btn-sm">Show</button>
      </form>
      <MonetaryLens data={data} />
      <WorkLens data={data} />
      <section aria-labelledby="queue-heading" className="mt-10 space-y-5">
        <SectionHeader id="queue-heading" index="03" code="OPS-Q" title="Your queue and recent activity">
          Your next meetings and open work, then the team&apos;s latest contributions and deals closing soon.
        </SectionHeader>
        <OverviewQueue data={data} />
      </section>
    </>
  );
}
