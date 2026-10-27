// Amounts travel as decimal text. All arithmetic uses integer cents (bigint) so sums never pick up
// floating-point error; currencies are never converted or combined.

export function cents(value: string | number): bigint {
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw new Error("Invalid monetary amount.");
  const [whole, fraction = ""] = text.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}

export function decimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const magnitude = value < 0n ? -value : value;
  return `${sign}${magnitude / 100n}.${String(magnitude % 100n).padStart(2, "0")}`;
}

export function formatCents(value: bigint, currency: string) {
  const [whole, fraction] = decimal(value).split(".");
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction}`;
}

export function money(value: string | number, currency: string) {
  return formatCents(cents(value), currency);
}

// Overachievement stays in its own period: nothing here carries a surplus into later targets.
export function targetPerformance(target: bigint, actual: bigint) {
  return {
    target: decimal(target),
    actual: decimal(actual),
    remaining: decimal(target > actual ? target - actual : 0n),
    over: decimal(actual > target ? actual - target : 0n),
    percentage: target ? decimal((actual * 10000n + target / 2n) / target) : null,
  };
}

// The share `amount` is of `total`, as a percentage rounded to two decimals without trailing zeros
// ("50", "12.5", "33.33"). Empty when either value is invalid or the total is zero.
export function percentOf(amount: string, total: string) {
  try {
    const whole = cents(total);
    if (!whole) return "";
    const hundredths = (cents(amount) * 10000n + whole / 2n) / whole;
    return decimal(hundredths).replace(/\.?0+$/, "");
  } catch {
    return "";
  }
}

// Rounds down to the cent; the caller shows any remainder so a manager can assign it explicitly.
export function percentAmount(amount: string, percentage: string) {
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(percentage) || cents(percentage) > 10000n)
    throw new Error("Use a percentage from 0 to 100 with at most two decimals.");
  return decimal((cents(amount) * cents(percentage)) / 10000n);
}
