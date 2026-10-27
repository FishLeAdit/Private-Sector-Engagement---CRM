import type { Report } from "@/features/reports/types";
import { StatCards } from "./stat-cards";

// Contacts engaged (assessment p10). The definition is a project proposal awaiting PSE confirmation
// (docs/09-reporting-definitions.md). Snapshots made before migration 0014 carry no figures, so nothing shows.
export function EngagementSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const e = report.engagement;
  if (!e) return null;
  return (
    <section aria-labelledby="engagement-heading" className="mt-9 space-y-5">
      <div>
        <h2 id="engagement-heading" className="text-2xl font-bold">
          Contacts engaged
        </h2>
        <p className="badge badge-warning badge-outline mt-2">Provisional — awaiting PSE definition</p>
        <p className="mt-2 text-sm text-base-content/65">
          Distinct CRM contacts reached by Done meetings and Done activities in the period. Owner filters apply;
          currency and funding vertical do not.
        </p>
      </div>
      <StatCards
        rows={[
          ["Contacts engaged", String(e.contacts)],
          ["Individuals", String(e.individuals)],
          ["Companies / organizations", String(e.companies)],
          ["Named, unlinked interactions", String(e.unlinked_named)],
        ]}
      />
      {detailed && (
        <div className="overflow-x-auto rounded-xl border border-base-300">
          <table className="table">
            <caption className="p-4 text-left font-semibold">Contacts engaged by owner</caption>
            <thead>
              <tr>
                <th>Owner</th>
                <th>Contacts engaged</th>
              </tr>
            </thead>
            <tbody>
              {e.owners.map(o => (
                <tr key={o.id}>
                  <td>{o.name}</td>
                  <td>{o.contacts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!e.owners.length && <p className="p-4 text-sm">No contacts engaged in this period.</p>}
        </div>
      )}
      <p className="text-xs leading-6 text-base-content/60">
        An interaction without its own contact counts its meeting&apos;s contact, then its deal&apos;s primary contact,
        then the deal&apos;s party. People or organizations named on an activity without a CRM link are counted as
        interactions, never as contacts. A contact engaged by two owners counts once in the total and once for each
        owner.
      </p>
    </section>
  );
}
