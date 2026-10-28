import { Readout } from "@/components/ui/hud";

// A cluster of headline figures in hairline-divided cells: each entry is [label, already formatted value].
// Cells stay transparent so the panel's surface and corner ticks show; half-pixel rings form 1px dividers.
export function StatCards({ rows }: { rows: [string, string][] }) {
  return (
    <div className="panel grid p-0 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="p-5 shadow-[0_0_0_0.5px_var(--color-base-300)]">
          <Readout label={label} value={value} />
        </div>
      ))}
    </div>
  );
}
