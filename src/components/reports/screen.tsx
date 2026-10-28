import { PageProblem } from "@/components/ui/page-problem";
import { reportsPage, reportData, reportPlan } from "@/features/reports/context";
import { quarterSeries } from "@/features/reports/quarters";
import { toDhakaDateTimeInput } from "@/lib/dates";
import { ReportView } from "./view";
export async function ReportScreen({
  view,
  searchParams,
}: {
  view: "dashboard" | "reports";
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const result = await reportData(async () => {
    const service = await reportsPage();
    return Promise.all([service.read(filters), service.options()]);
  });
  if (!result.ok) {
    const signedOut = result.error.status === 401;
    return (
      <PageProblem
        title={`${view === "dashboard" ? "Dashboard" : "Reports"} could not be loaded`}
        message={result.error.message}
        links={[
          signedOut
            ? { href: "/login", label: "Sign in again" }
            : { href: `/${view}`, label: "Reset filters and retry" },
        ]}
      />
    );
  }
  const [{ filters: input, report }, options] = result.data;
  // Quarter charts need the plan's quarter baselines and cells; only full-year views show them.
  const plan =
    input.period === "year" && report.fundraising.plan_id ? await reportPlan(report.fundraising.plan_id) : null;
  const quarters = quarterSeries(report, plan, input, toDhakaDateTimeInput(new Date().toISOString()));
  return <ReportView view={view} filters={input} report={report} options={options} quarters={quarters} />;
}
