// Axis ticks round to clean, compact numbers (0 / 450K / 1.2M); exact values live in labels, tooltips and tables.
export function compact(value: number) {
  const units: [number, string][] = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [size, suffix] of units)
    if (Math.abs(value) >= size) return `${Number((value / size).toFixed(1))}${suffix}`;
  return String(Number(value.toFixed(2)));
}

// Decimal money text as a number for plotting only; arithmetic stays in integer cents elsewhere.
export const plotValue = (amount: string | null) => (amount === null ? null : Number(amount));
