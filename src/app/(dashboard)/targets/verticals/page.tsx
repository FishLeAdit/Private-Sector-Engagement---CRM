import Link from "next/link";
import { financePage, financeData } from "@/features/finance/context";
import { FinanceProblem } from "@/components/finance/problem";
import { VerticalForm } from "@/components/finance/vertical-form";
import { isPseManager } from "@/lib/auth/roles";
export default async function Page() {
  const { service, access } = await financePage();
  if (!isPseManager(access.profile))
    return <FinanceProblem message="Only an authorized manager can configure target verticals." />;
  const result = await financeData(() => service.options());
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  return (
    <>
      <Link href="/targets" className="link text-sm">
        ← Targets
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold">Target verticals</h1>
      <VerticalForm verticals={result.data.verticals} />
    </>
  );
}
