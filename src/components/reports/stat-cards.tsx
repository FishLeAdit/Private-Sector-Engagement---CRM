// A row of headline figures: each entry is [label, already formatted value].
export function StatCards({ rows }: { rows: [string, string][] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([name, value]) => (
        <div key={name} className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-5">
          <h3 className="text-sm text-base-content/60">{name}</h3>
          <p className="mt-3 break-words text-xl font-bold tabular-nums">{value}</p>
        </div>
      ))}
    </div>
  );
}
