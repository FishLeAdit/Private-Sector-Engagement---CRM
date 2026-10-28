"use client";
import type { TooltipContentProps } from "recharts";

// One tooltip for every series at the hovered position: the value leads, the series name follows, keyed by a
// short line in the series colour. Values come pre-formatted from each row's `<key>Label` field.
export function ChartTooltip({ active, payload, label }: Partial<TooltipContentProps>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-base-300 bg-base-200 px-3 py-2 font-mono text-xs shadow-none">
      <p className="mb-1 uppercase tracking-wider text-muted">{label}</p>
      {payload.map(item => {
        const row = item.payload as Record<string, unknown>;
        const text = row[`${String(item.dataKey)}Label`];
        if (text === undefined || text === null || text === "") return null;
        return (
          <p key={String(item.dataKey)} className="flex items-center gap-2">
            <span className="inline-block h-0.5 w-3" style={{ backgroundColor: String(item.color ?? item.fill) }} />
            <strong className="font-sans text-sm font-semibold">{String(text)}</strong>
            <span className="text-muted">{item.name}</span>
          </p>
        );
      })}
    </div>
  );
}
