import type { CacheBackend, CacheScope } from "@/lib/cache/policy";
import { cacheSpec } from "@/lib/cache/policy";
import type { ReportFilters } from "./schemas";
import type { Report, ReportOptions } from "./types";
// Profile names are never persisted in a report cache. Hydrate them from a fresh
// caller-scoped lookup on every request, including hits and role/department changes.
function redactProfiles(report: Report): Report {
  return {
    ...report,
    fundraising: {
      ...report.fundraising,
      dimensions: report.fundraising.dimensions.map(row => ({ ...row, employee_name: "Historical employee" })),
    },
    workload: { ...report.workload, owners: report.workload.owners.map(row => ({ ...row, name: "Historical owner" })) },
  };
}
export function hydrateProfiles(report: Report, employees: ReportOptions["employees"]): Report {
  const names = new Map(employees.map(e => [e.id, e.display_name]));
  return {
    ...report,
    fundraising: {
      ...report.fundraising,
      dimensions: report.fundraising.dimensions.map(row => ({
        ...row,
        employee_name: names.get(row.employee_id) ?? "Historical employee",
      })),
    },
    workload: {
      ...report.workload,
      owners: report.workload.owners.map(row => ({ ...row, name: names.get(row.id) ?? "Historical owner" })),
    },
  };
}
export function createReportCache(backend: CacheBackend, scope: CacheScope, now: () => number = Date.now) {
  return {
    read(filters: ReportFilters, load: () => Promise<Report>) {
      const identity = JSON.stringify([
        filters.year,
        filters.period,
        filters.employee_id,
        filters.vertical_id,
        filters.currency,
      ]);
      return backend.get(cacheSpec(scope, "report", identity, now()), async () => redactProfiles(await load()));
    },
    verticals(load: () => Promise<ReportOptions["verticals"]>) {
      return backend.get(cacheSpec(scope, "verticals", "lookup", now()), load);
    },
  };
}
export type ReportCache = ReturnType<typeof createReportCache>;
