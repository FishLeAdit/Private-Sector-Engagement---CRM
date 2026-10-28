import { cents } from "@/lib/money";

// A linear gauge for actual against target: a soft track, the accent fill, and a tick at the target. Past the
// target the scale stretches so the overachievement shows beyond the tick. Decorative; callers state the values.
export function TapeMeter({ actual, target }: { actual: string; target: string | null }) {
  const a = cents(actual),
    t = target === null ? 0n : cents(target);
  if (t <= 0n) return null;
  const scale = a > t ? a : t;
  const percent = (value: bigint) => Number((value * 10000n) / scale) / 100;
  return (
    <div aria-hidden="true" className="relative mt-3 h-2" style={{ backgroundColor: "var(--chart-soft)" }}>
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${percent(a)}%`, backgroundColor: "var(--chart-accent)" }}
      />
      <div className="absolute -top-1 h-4 w-px bg-base-content" style={{ left: `calc(${percent(t)}% - 0.5px)` }} />
    </div>
  );
}
