import { ReportScreen } from "@/components/reports/screen";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <ReportScreen view="reports" searchParams={searchParams} />;
}
