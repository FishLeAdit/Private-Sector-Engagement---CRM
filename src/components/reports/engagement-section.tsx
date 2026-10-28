import type { Report } from "@/features/reports/types";
import { StatusPip } from "@/components/ui/hud";
import { SectionHeader } from "./section-header";
import { StatCards } from "./stat-cards";

// Contacts engaged (assessment p10). The definition is a project proposal awaiting PSE confirmation
// (docs/09-reporting-definitions.md). Snapshots made before migration 0014 carry no figures, so nothing shows.
export function EngagementSection({ report, detailed }: { report: Report; detailed: boolean }) {
  const e = report.engagement;
  if (!e) return null;
  return (
    <section id="engagement" aria-labelledby="engagement-heading" className="mt-10 scroll-mt-16 space-y-5">
      <SectionHeader id="engagement-heading" index="04" code="CON-01" title="Contacts engaged">
        Distinct CRM contacts reached by Done meetings and Done activities in the period. Owner filters apply; currency
        and funding vertical do not.
      </SectionHeader>
      <StatusPip tone="warning" label="Provisional — awaiting PSE definition" />
      <StatCards
        rows={[
          ["Contacts engaged", String(e.contacts)],
          ["Individuals", String(e.individuals)],
          ["Companies / organizations", String(e.companies)],
          ["Named, unlinked interactions", String(e.unlinked_named)],
        ]}
      />
      {detailed && (
        <div className="panel overflow-x-auto p-0">
          <table className="table">
            <caption className="p-4 text-left font-mono text-xs font-semibold uppercase tracking-[0.1em]">
              Contacts engaged by owner
            </caption>
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
      <p className="text-xs leading-6 text-muted">
        An interaction without its own contact counts its meeting&apos;s contact, then its deal&apos;s primary contact,
        then the deal&apos;s party. People or organizations named on an activity without a CRM link are counted as
        interactions, never as contacts. A contact engaged by two owners counts once in the total and once for each
        owner.
      </p>
    </section>
  );
}
