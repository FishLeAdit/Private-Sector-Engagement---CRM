// Monetary values use integer cents when adding the visible page.
export function toCents(value: string | number): bigint {
  const [whole, fraction = ""] = String(value).split(".");
  return BigInt(whole) * BigInt(100) + BigInt(fraction.padEnd(2, "0").slice(0, 2));
}
export function formatCents(cents: bigint, currency: string) {
  return `${currency} ${(cents / BigInt(100)).toLocaleString("en-GB")}.${String(cents % BigInt(100)).padStart(2, "0")}`;
}
export function formatMoney(value: string | number, currency: string) { return formatCents(toCents(value), currency); }
