import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessResult } from "../../src/lib/auth/session";
import type { ReportRepository } from "../../src/features/reports/queries";
import { cacheScope, cacheSpec, cacheTags } from "../../src/lib/cache/policy";
import { createReportCache } from "../../src/features/reports/cache";
import { MeasurementCache } from "../../scripts/lib/measurement-cache";
import { reportFixture } from "../helpers/report-fixture";
vi.mock("server-only", () => ({}));
import { createReportsService } from "../../src/features/reports/service";
const member = "00000000-0000-4000-8000-000000000002",
  filters = { year: 2026, period: "year" as const, employee_id: "", vertical_id: "", currency: "BDT" };
function access(): Extract<AccessResult, { status: "allowed" }> {
  return {
    status: "allowed",
    userId: member,
    profile: { id: member, display_name: "Fictional Employee", department: "PSE", role: "pse_member", active: true },
  };
}
let backend: MeasurementCache, clock: number;
beforeEach(() => {
  clock = 0;
  backend = new MeasurementCache(() => clock);
});
function repository() {
  return {
    read: vi.fn<ReportRepository["read"]>().mockResolvedValue(reportFixture()),
    employees: vi
      .fn<ReportRepository["employees"]>()
      .mockResolvedValue([{ id: member, display_name: "Fresh employee name", active: true }]),
    verticals: vi
      .fn<ReportRepository["verticals"]>()
      .mockResolvedValue([{ id: "vertical", name: "Fictional vertical", active: true, is_provisional: true }]),
    options: vi.fn<ReportRepository["options"]>(),
  };
}
const scope = () => cacheScope(access(), "https://example.supabase.co", "fictional-session-token");
describe("private report caching", () => {
  it("hits the same scope/filter bucket while keeping profiles fresh on every request", async () => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    for (let i = 0; i < 2; i++) await createReportsService(repo, access(), cache).read(filters);
    expect(repo.read).toHaveBeenCalledTimes(1);
    expect(repo.employees).toHaveBeenCalledTimes(2);
  });
  it.each(["year", "period", "employee_id", "vertical_id", "currency"] as const)("isolates filter %s", async field => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    await createReportsService(repo, access(), cache).read(filters);
    const change = { year: 2027, period: "q1", employee_id: member, vertical_id: "unassigned", currency: "USD" };
    await createReportsService(repo, access(), cache).read({ ...filters, [field]: change[field] });
    expect(repo.read).toHaveBeenCalledTimes(2);
  });
  it.each(["user", "role", "project", "session"])("isolates %s scope", async field => {
    const repo = repository(),
      original = scope(),
      other = { ...original };
    if (field === "user") other.userId = "other-user";
    if (field === "role") other.role = "pse_manager";
    if (field === "project") other.project = "other-project";
    if (field === "session") other.session = "other-session";
    await createReportCache(backend, original, () => clock).read(filters, () => repo.read(filters));
    await createReportCache(backend, other, () => clock).read(filters, () => repo.read(filters));
    expect(repo.read).toHaveBeenCalledTimes(2);
  });
  it("blocks reads at the 30-second boundary and never falls back to an expired snapshot", async () => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    await cache.read(filters, () => repo.read(filters));
    clock = 29999;
    await cache.read(filters, () => repo.read(filters));
    expect(repo.read).toHaveBeenCalledTimes(1);
    clock = 30000;
    repo.read.mockRejectedValueOnce(new Error("Provider unavailable"));
    await expect(cache.read(filters, () => repo.read(filters))).rejects.toThrow("Provider unavailable");
    repo.read.mockResolvedValueOnce({
      ...reportFixture(),
      fundraising: { ...reportFixture().fundraising, actual: "280100" },
    });
    expect((await cache.read(filters, () => repo.read(filters))).fundraising.actual).toBe("280100");
  });
  it("keeps vertical metadata for five minutes while profiles are request scoped", async () => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    await createReportsService(repo, access(), cache).options();
    clock = 299999;
    await createReportsService(repo, access(), cache).options();
    expect(repo.verticals).toHaveBeenCalledTimes(1);
    clock = 300000;
    await createReportsService(repo, access(), cache).options();
    expect(repo.verticals).toHaveBeenCalledTimes(2);
    expect(repo.employees).toHaveBeenCalledTimes(3);
  });
  it("never stores profile names and rehydrates changed/hidden identities on a warm hit", async () => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    const first = await createReportsService(repo, access(), cache).read(filters);
    expect(first.report.fundraising.dimensions[0].employee_name).toBe("Fresh employee name");
    expect(JSON.stringify(backend.values())).not.toContain("Fresh employee name");
    expect(JSON.stringify(backend.values())).not.toContain("Fictional Employee");
    repo.employees.mockResolvedValueOnce([
      { id: "different-permitted-profile", display_name: "Other employee", active: true },
    ]);
    const second = await createReportsService(repo, access(), cache).read(filters);
    expect(second.report.fundraising.dimensions[0].employee_name).toBe("Historical employee");
    expect(repo.read).toHaveBeenCalledTimes(1);
  });
  it.each(["anonymous", "forbidden", "unavailable"] as const)(
    "denies %s before consulting a warm cache",
    async status => {
      const repo = repository(),
        cache = createReportCache(backend, scope(), () => clock);
      await createReportsService(repo, access(), cache).read(filters);
      const get = vi.spyOn(backend, "get");
      await expect(createReportsService(repo, { status }, cache).read(filters)).rejects.toThrow();
      expect(get).not.toHaveBeenCalled();
    },
  );
  it.each(["active", "department", "id"])("rejects revoked/mismatched %s despite a warm cache", async field => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    await createReportsService(repo, access(), cache).read(filters);
    const actor = access();
    if (field === "active") actor.profile.active = false;
    if (field === "department") actor.profile.department = "HR";
    if (field === "id") actor.profile.id = "different";
    const get = vi.spyOn(backend, "get");
    await expect(createReportsService(repo, actor, cache).read(filters)).rejects.toMatchObject({ status: 403 });
    expect(get).not.toHaveBeenCalled();
  });
  it("expires reports for every cached user after a shared mutation and only one user on manual refresh", async () => {
    const a = scope(),
      b = { ...a, userId: "other" },
      repo = repository();
    await createReportCache(backend, a, () => clock).read(filters, () => repo.read(filters));
    await createReportCache(backend, b, () => clock).read(filters, () => repo.read(filters));
    backend.invalidate(cacheTags(a.project, a.userId).user);
    await createReportCache(backend, a, () => clock).read(filters, () => repo.read(filters));
    await createReportCache(backend, b, () => clock).read(filters, () => repo.read(filters));
    expect(repo.read).toHaveBeenCalledTimes(3);
    backend.invalidate(cacheTags(a.project).reports);
    await createReportCache(backend, a, () => clock).read(filters, () => repo.read(filters));
    await createReportCache(backend, b, () => clock).read(filters, () => repo.read(filters));
    expect(repo.read).toHaveBeenCalledTimes(5);
  });
  it("keeps raw credentials out of keys and separates buckets deterministically", () => {
    const value = scope(),
      key = cacheSpec(value, "report", "filters", 0);
    expect(JSON.stringify(key)).not.toContain("fictional-session-token");
    expect(key.key).not.toEqual(cacheSpec(value, "report", "filters", 30000).key);
    expect(() => cacheScope({ status: "anonymous" }, "https://example.supabase.co", "token")).toThrow();
    expect(() => cacheScope(access(), "https://example.supabase.co", "")).toThrow();
  });
  it("does not mutate stored snapshots when profile hydration differs across requests", async () => {
    const repo = repository(),
      cache = createReportCache(backend, scope(), () => clock);
    const first = await createReportsService(repo, access(), cache).read(filters);
    first.report.fundraising.dimensions[0].employee_name = "Changed in caller";
    const second = await createReportsService(repo, access(), cache).read(filters);
    expect(second.report.fundraising.dimensions[0].employee_name).toBe("Fresh employee name");
  });
});
