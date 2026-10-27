// Decimal input stays text; use integer cents for allocation and performance arithmetic.
export function cents(value: string | number): bigint {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Invalid monetary amount.");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "",
    magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, "0")}`;
}
export function money(value: string | number, currency: string) {
  const text = decimal(cents(value)),
    [whole, fraction] = text.split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}
export function performance(target: bigint, actual: bigint) {
  return {
    target: decimal(target),
    actual: decimal(actual),
    remaining: decimal(target > actual ? target - actual : 0n),
    over: decimal(actual > target ? actual - target : 0n),
    percentage: target ? decimal((actual * 10000n + target / 2n) / target) : null,
  };
}
export function percentAmount(amount: string, percentage: string) {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(percentage) || cents(percentage) > 10000n)
    throw new Error("Use a percentage from 0 to 100 with at most two decimals.");
  return decimal((cents(amount) * cents(percentage)) / 10000n);
}
