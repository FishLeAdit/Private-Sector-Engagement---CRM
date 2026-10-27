import "server-only";
import type { AccessResult } from "@/lib/auth/session";
import { isActivePseProfile } from "@/lib/auth/roles";
import { parseReportFilters } from "./schemas";
import { ReportError } from "./types";
import type { ReportRepository } from "./queries";
import { hydrateProfiles, type ReportCache } from "./cache";
export function createReportsService(repo: ReportRepository, access: AccessResult, cache?: ReportCache) {
  function authorize() {
    if (access.status !== "allowed" || !isActivePseProfile(access.profile) || access.profile.id !== access.userId)
      throw new ReportError(
        access.status === "anonymous" ? 401 : access.status === "unavailable" ? 503 : 403,
        "Active PSE access is required.",
      );
  }
  let employees: ReturnType<ReportRepository["employees"]> | undefined;
  const freshEmployees = () => (employees ??= repo.employees()); // Per-request/service instance only.
  return {
    async read(input: unknown) {
      authorize();
      const parsed = parseReportFilters(input);
      if (!parsed.success)
        throw new ReportError(422, parsed.error.issues[0]?.message ?? "Choose valid report filters.");
      const [report, names] = await Promise.all([
        cache ? cache.read(parsed.data, () => repo.read(parsed.data)) : repo.read(parsed.data),
        freshEmployees(),
      ]);
      return { filters: parsed.data, report: hydrateProfiles(report, names) };
    },
    async options() {
      authorize();
      const [names, verticals] = await Promise.all([
        freshEmployees(),
        cache ? cache.verticals(() => repo.verticals()) : repo.verticals(),
      ]);
      return { employees: names, verticals };
    },
  };
}
