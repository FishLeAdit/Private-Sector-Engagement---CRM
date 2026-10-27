import Link from "next/link";
import type { Report } from "@/features/reports/types";
import { reportPeriodLabel, type ReportFilters } from "@/features/reports/schemas";
import { formatDate } from "@/lib/dates";
import { RefreshReport } from "./refresh-button";

type Props = {
  view: "dashboard" | "reports";
  filters: ReportFilters;
  report: Report;
  query: string; // Current filters, carried over when switching between Dashboard and Reports.
};

export function ReportHeader({ view, filters, report, query }: Props) {
  const isDashboard = view === "dashboard";
  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm text-base-content/60">
            {reportPeriodLabel(filters.period)} · {filters.year} · {report.currency}
          </p>
          <h1 className="text-3xl font-bold">{isDashboard ? "PSE dashboard" : "Performance reports"}</h1>
          <p className="mt-2 text-sm text-base-content/65">
            Fundraising achievement and relationship workload, shown separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <RefreshReport />
          <Link href={`/${isDashboard ? "reports" : "dashboard"}?${query}`} className="btn btn-ghost btn-sm">
            {isDashboard ? "Detailed reports" : "Dashboard overview"}
          </Link>
        </div>
      </div>
      <p className="mb-5 text-xs text-base-content/55">
        Updated {formatDate(report.generated_at, true)} · Asia/Dhaka · Snapshots may be up to 30 seconds old; Refresh
        data requests a new snapshot.
      </p>
    </>
  );
}
