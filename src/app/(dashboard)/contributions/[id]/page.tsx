import Link from "next/link";
import { notFound } from "next/navigation";
import { contributionPage } from "@/features/contributions/context";
import { financeData } from "@/features/finance/context";
import { FinanceProblem } from "@/components/finance/problem";
import { money } from "@/lib/money";
import { formatDate } from "@/lib/dates";
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { service } = await contributionPage();
  const { id } = await params;
  const loaded = await financeData(() => service.contribution(id));
  if (!loaded.ok) {
    if ([400, 404].includes(loaded.error.status)) notFound();
    return <FinanceProblem message={loaded.error.message} />;
  }
  const row = loaded.data;
  return (
    <>
      <Link href="/contributions" className="link text-sm">
        ← Contributions
      </Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold">{money(row.amount, row.currency)} recognized</h1>
      <section className="max-w-3xl space-y-5 rounded-xl border border-base-300 p-6">
        <Link href={`/opportunities/${row.opportunity_id}`} className="link font-medium">
          {row.opportunity?.deal_name ?? "Opportunity"}
        </Link>
        <dl className="grid gap-5 sm:grid-cols-2">
          {[
            ["Recognition time (Asia/Dhaka)", formatDate(row.recognized_at, true)],
            ["Employee", row.employee?.display_name ?? "Historical employee"],
            ["Vertical", row.vertical?.name ?? "Unassigned"],
            ["Type", row.contribution_type === "cash" ? "Cash" : "Valued in-kind"],
            ["Recorded by", row.recorder?.display_name ?? "System / historical recorder"],
            ["Recorded at", formatDate(row.created_at, true)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-sm text-base-content/60">{key}</dt>
              <dd className="mt-1">{value}</dd>
            </div>
          ))}
        </dl>
        {row.approved_value_note && (
          <div>
            <h2 className="font-semibold">Agreed valuation / estimate source</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.approved_value_note}</p>
          </div>
        )}
        {row.valuation_reference_url && (
          <a className="link break-all" href={row.valuation_reference_url} target="_blank" rel="noreferrer">
            Inventory / estimate reference
          </a>
        )}
        <p className="whitespace-pre-wrap break-words text-sm">{row.notes || "No notes recorded."}</p>
        <p className="text-xs text-base-content/60">
          Append-only financial entry. Refund/correction workflows are outside this release. Recognition time determines
          the reporting quarter in Asia/Dhaka; no currency conversion is applied.
        </p>
      </section>
    </>
  );
}
