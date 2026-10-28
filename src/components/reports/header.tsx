import Link from "next/link";
import type { Report } from "@/features/reports/types";
import { reportPeriodLabel, type ReportFilters } from "@/features/reports/schemas";
import { formatDate } from "@/lib/dates";
import { PanelHeader, StatusPip } from "@/components/ui/hud";
import { RefreshReport } from "./refresh-button";

type Props = {
  view: "dashboard" | "reports";
  filters: ReportFilters;
  report: Report;
  query: string; // Current filters, carried over when switching between Dashboard and Reports.
};

export function ReportHeader({ view, filters, report, query }: Props) {
  const isDashboard = view === "dashboard";
  const period = filters.period === "year" ? "FY" : filters.period.toUpperCase();
  return (
    <div className="mb-6">
      <PanelHeader
        level={1}
        code={`SYS.RPT // ${period}-${filters.year} · ${report.currency}`}
        title={isDashboard ? "PSE dashboard" : "Performance reports"}
      >
        <RefreshReport />
        <Link href={`/${isDashboard ? "reports" : "dashboard"}?${query}`} className="btn btn-ghost btn-sm">
          {isDashboard ? "Detailed reports" : "Dashboard overview"}
        </Link>
      </PanelHeader>
      <p className="text-sm text-muted">
        {reportPeriodLabel(filters.period)} · {filters.year} · {report.currency} · Fundraising achievement and
        relationship workload, shown separately.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        <StatusPip tone="nominal" label={`Updated ${formatDate(report.generated_at, true)}`} />
        <span>Asia/Dhaka · Snapshots may be up to 30 seconds old; Refresh data requests a new snapshot.</span>
      </p>
    </div>
  );
}
