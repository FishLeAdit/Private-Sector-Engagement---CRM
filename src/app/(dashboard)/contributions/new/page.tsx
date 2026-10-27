import Link from "next/link";
import { contributionPage } from "@/features/contributions/context";
import { financeData } from "@/features/finance/context";
import { ContributionForm } from "@/components/contributions/contribution-form";
import { FinanceProblem } from "@/components/finance/problem";
export default async function Page({ searchParams }: { searchParams: Promise<{ opportunity_id?: string }> }) {
  const { service, access } = await contributionPage();
  const { id } = { id: (await searchParams).opportunity_id };
  if (!id)
    return (
      <>
        <h1 className="text-3xl font-bold">Record a contribution</h1>
        <p className="my-5">Open an opportunity and choose Record contribution to enter actual received support.</p>
        <Link href="/opportunities" className="btn btn-primary">
          Choose opportunity
        </Link>
      </>
    );
  const result = await financeData(() => Promise.all([service.opportunity(id), service.options()]));
  if (!result.ok) return <FinanceProblem message={result.error.message} />;
  return (
    <>
      <Link href={`/opportunities/${id}`} className="link text-sm">
        ← Opportunity
      </Link>
      <h1 className="mb-7 mt-4 text-3xl font-bold">Record contribution</h1>
      <ContributionForm opportunity={result.data[0]} options={result.data[1]} userId={access.userId} />
    </>
  );
}
