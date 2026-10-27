// Display helpers shared by the report sections.

export const labelFor = (key: string, labels: Record<string, string>) => labels[key] ?? key.replaceAll("_", " ");

// "2026-03" → "Mar". Months are calendar buckets already computed in Asia/Dhaka by the report SQL.
export const monthLabel = (value: string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(`${value}-01T00:00Z`));
