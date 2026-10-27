export function formatDate(value: string | null, includeTime = false) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
    timeZone: "Asia/Dhaka",
  }).format(date);
}

// datetime-local has no timezone. Interpret meeting input explicitly in Dhaka,
// regardless of the browser/host timezone, and persist an absolute UTC instant.
export function toDhakaDateTimeInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${get("year").padStart(4, "0")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function fromDhakaDateTimeInput(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const wall = new Date(`${value}:00Z`);
  if (Number.isNaN(wall.getTime()) || wall.toISOString().slice(0, 16) !== value) return "";
  let instant = wall.getTime();
  for (let attempt = 0; attempt < 4; attempt++) {
    const seen = toDhakaDateTimeInput(new Date(instant).toISOString());
    if (seen === value) return new Date(instant).toISOString();
    const seenTime = new Date(`${seen}:00Z`).getTime();
    if (!Number.isFinite(seenTime)) return "";
    instant += wall.getTime() - seenTime;
  }
  return "";
}
