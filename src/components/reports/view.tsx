import type { Report, ReportOptions } from "@/features/reports/types";
import type { ReportFilters } from "@/features/reports/schemas";
import { ReportDefinitions } from "./definitions";
import { EngagementSection } from "./engagement-section";
import { ReportFiltersForm } from "./filters";
import { FundraisingSection } from "./fundraising-section";
import { ReportHeader } from "./header";
import { PipelineSection } from "./pipeline-section";
import { WorkloadSection } from "./workload-section";

type Props = {
  view: "dashboard" | "reports";
  filters: ReportFilters;
  report: Report;
  options: ReportOptions;
};

// Dashboard and Reports share one layout; Reports adds full tables under each section.
export function ReportView({ view, filters, report, options }: Props) {
  const query = new URLSearchParams(Object.entries(filters).map(([key, value]) => [key, String(value)])).toString();
  const detailed = view === "reports";
  return (
    <>
      <ReportHeader view={view} filters={filters} report={report} query={query} />
      <ReportFiltersForm key={query} path={`/${view}`} filters={filters} options={options} />
      <FundraisingSection report={report} monthly={filters.period.startsWith("m")} detailed={detailed} />
      <PipelineSection report={report} detailed={detailed} />
      <WorkloadSection report={report} detailed={detailed} />
      <EngagementSection report={report} detailed={detailed} />
      <ReportDefinitions report={report} />
    </>
  );
}
