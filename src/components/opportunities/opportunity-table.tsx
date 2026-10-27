import Link from "next/link";
import type { OpportunityRecord } from "@/features/opportunities/types";
import { formatDate } from "@/lib/dates";
import { money } from "@/lib/money";

export function OpportunityTable({ rows }: { rows: OpportunityRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300">
      <table className="table">
        <caption className="sr-only">Opportunities matching the selected filters</caption>
        <thead>
          <tr>
            <th>Deal / contact</th>
            <th>Stage</th>
            <th>Expected value</th>
            <th>Type / category</th>
            <th>Focal person</th>
            <th>Expected closing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>
                <Link href={`/opportunities/${row.id}`} className="link link-hover font-semibold">
                  {row.deal_name}
                </Link>
                <p className="mt-1 text-xs text-base-content/60">{row.contact?.name}</p>
              </td>
              <td>{row.stage?.name}</td>
              <td className="whitespace-nowrap">{money(row.expected_amount, row.currency)}</td>
              <td>
                {row.contribution_type === "cash" ? "Cash" : "Valued in-kind"}
                <p className="mt-1 text-xs text-base-content/60">{row.category?.name}</p>
              </td>
              <td>{row.owner?.display_name}</td>
              <td>{formatDate(row.expected_close_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
