export function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", ...(includeTime ? { timeStyle: "short" as const } : {}), timeZone: "Asia/Dhaka" }).format(date);
}
