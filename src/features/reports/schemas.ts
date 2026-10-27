import { z } from "zod";
import { currency,optionalId } from "@/features/finance/schemas";
import { toDhakaDateTimeInput } from "@/lib/dates";
export const reportPeriods=["year","q1","q2","q3","q4","m01","m02","m03","m04","m05","m06","m07","m08","m09","m10","m11","m12"]as const;
export const reportFiltersSchema=z.object({
  year:z.coerce.number().int().min(1).max(9998).default(()=>Number(toDhakaDateTimeInput(new Date().toISOString()).slice(0,4))),
  period:z.enum(reportPeriods).default("year"),employee_id:optionalId.default(""),vertical_id:z.union([optionalId,z.literal("unassigned")]).default(""),currency,
}).strict();
// Currency is required at the SQL boundary; the application starts with BDT.
export function parseReportFilters(input:unknown){return reportFiltersSchema.safeParse(input&&typeof input==="object"?{currency:"BDT",...input}:input);}
export type ReportFilters=z.output<typeof reportFiltersSchema>;
export function reportPeriodLabel(period:string){if(period==="year")return"Full year";if(period.startsWith("q"))return`Q${period.slice(1)}`;return new Intl.DateTimeFormat("en",{month:"long",timeZone:"UTC"}).format(new Date(`2026-${period.slice(1)}-01T00:00Z`));}
