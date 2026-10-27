import Link from "next/link";
import { notFound } from "next/navigation";
import { financeData } from "@/features/finance/context";
import { targetPage } from "@/features/targets/context";
import { FinanceProblem } from "@/components/finance/problem";
import { TargetForm } from "@/components/targets/target-form";
import { isPseManager } from "@/lib/auth/roles";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { service, access } = await targetPage();
  if (!isPseManager(access.profile))
    return <FinanceProblem message="Only an authorized manager can edit target plans." />;
  const { id } = await params,
    result = await financeData(() => Promise.all([service.details(id), service.options()]));
  if (!result.ok) {
    if ([400, 404].includes(result.error.status)) notFound();
    return <FinanceProblem message={result.error.message} />;
  }
  const [{ plan, allocations }, options] = result.data;
  if (plan.status !== "draft") return <FinanceProblem message="Approved targets are locked and cannot be edited." />;
  return (
    <>
      <Link href={`/targets/${id}`} className="link text-sm">
        ← Target plan
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold">Edit {plan.year} target draft</h1>
      <TargetForm
        year={plan.year}
        options={options}
        initial={{
          request_id: id,
          expected_updated_at: plan.updated_at,
          year: plan.year,
          currency: plan.currency,
          annual_amount: String(plan.annual_amount),
          quarters: [1, 2, 3, 4].map(quarter => ({
            quarter,
            amount: String(plan.quarters.find(q => q.quarter === quarter)?.amount ?? 0),
          })),
          allocations: allocations.map(a => ({
            quarter: a.quarter,
            employee_id: a.employee_id,
            vertical_id: a.vertical_id,
            amount: String(a.amount),
          })),
        }}
      />
    </>
  );
}
