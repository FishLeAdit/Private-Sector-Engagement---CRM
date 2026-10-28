import { OverviewScreen } from "@/components/overview/screen";
export default function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <OverviewScreen searchParams={searchParams} />;
}
