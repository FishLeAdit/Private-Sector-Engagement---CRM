import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextResponse } from "next/server";
import { ReportError } from "../../src/features/reports/types";
import type { ReportRepository } from "../../src/features/reports/queries";
import { reportFixture } from "../helpers/report-fixture";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), client: vi.fn(), repo: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("../../src/features/reports/queries", () => ({ createReportRepository: mocks.repo }));
vi.mock("../../src/features/reports/request-service", () => ({
  reportRequestService: async (access: Parameters<typeof createReportsService>[1]) =>
    createReportsService(repo, access),
}));
import { GET } from "../../src/app/api/reports/route";
import { createReportsService } from "../../src/features/reports/service";
const member = "00000000-0000-4000-8000-000000000002";
let repo: {
  read: Mock<ReportRepository["read"]>;
  options: Mock<ReportRepository["options"]>;
  employees: Mock<ReportRepository["employees"]>;
  verticals: Mock<ReportRepository["verticals"]>;
};
let actor: {
  status: "allowed";
  userId: string;
  profile: { id: string; active: boolean; department: string; role: string; display_name: string };
};
beforeEach(() => {
  vi.clearAllMocks();
  actor = {
    status: "allowed",
    userId: member,
    profile: { id: member, active: true, department: "PSE", role: "pse_member", display_name: "Fictional Employee" },
  };
  repo = {
    read: vi.fn<ReportRepository["read"]>().mockResolvedValue(reportFixture()),
    options: vi.fn<ReportRepository["options"]>().mockResolvedValue({ employees: [], verticals: [] }),
    employees: vi.fn<ReportRepository["employees"]>().mockResolvedValue([]),
    verticals: vi.fn<ReportRepository["verticals"]>().mockResolvedValue([]),
  };
  mocks.authorize.mockResolvedValue({ ok: true, access: actor });
  mocks.repo.mockReturnValue(repo);
});
const request = (query = "") => new Request("http://localhost/api/reports" + (query ? "?" + query : ""));
describe("reporting HTTP and shared service", () => {
  it.each([401, 403, 503])("denies authentication state %s before data access", async status => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    expect((await GET(request())).status).toBe(status);
    expect(mocks.client).not.toHaveBeenCalled();
    expect(repo.read).not.toHaveBeenCalled();
  });
  it("returns live report data with private/no-store headers to an ordinary PSE member", async () => {
    const response = await GET(request("year=2026"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      filters: { year: 2026, period: "year", currency: "BDT" },
      report: { fundraising: { actual: "280000" } },
    });
    expect(repo.read).toHaveBeenCalledWith({
      year: 2026,
      period: "year",
      employee_id: "",
      vertical_id: "",
      currency: "BDT",
    });
  });
  it("preserves employee/vertical/month/currency filters without changing meanings", async () => {
    expect(
      (await GET(request(`year=2026&period=m03&employee_id=${member}&vertical_id=unassigned&currency=usd`))).status,
    ).toBe(200);
    expect(repo.read).toHaveBeenCalledWith({
      year: 2026,
      period: "m03",
      employee_id: member,
      vertical_id: "unassigned",
      currency: "USD",
    });
  });
  it.each([
    "year=0",
    "year=9999",
    "year=2026.5",
    "period=q5",
    "period=m13",
    "employee_id=bad",
    "vertical_id=bad",
    "currency=BDT,USD",
    "unapproved_kpi=lead",
  ])("rejects invalid filters %s before executing aggregates", async query => {
    expect((await GET(request(query))).status).toBe(422);
    expect(repo.read).not.toHaveBeenCalled();
  });
  it.each(["id", "department", "role", "active"])("rechecks %s in the feature service", async field => {
    if (field === "id") actor.profile.id = "other";
    if (field === "department") actor.profile.department = "HR";
    if (field === "role") actor.profile.role = "staff";
    if (field === "active") actor.profile.active = false;
    expect((await GET(request())).status).toBe(403);
    expect(repo.read).not.toHaveBeenCalled();
  });
  it("returns safe database permission and provider failures", async () => {
    repo.read.mockRejectedValueOnce(new ReportError(403, "Active PSE access required."));
    expect((await GET(request())).status).toBe(403);
    repo.read.mockRejectedValueOnce(new Error("Sensitive database connection detail"));
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("Sensitive");
  });
  it("loads only authorized metadata and rejects repeated page-filter arrays", async () => {
    const service = createReportsService(repo, actor as Parameters<typeof createReportsService>[1]);
    expect(await service.options()).toEqual({ employees: [], verticals: [] });
    await expect(service.read({ year: ["2026", "2027"] })).rejects.toMatchObject({ status: 422 });
  });
  it("runs a fresh query on each read rather than caching aggregate results", async () => {
    repo.read
      .mockResolvedValueOnce(reportFixture())
      .mockResolvedValueOnce({ ...reportFixture(), fundraising: { ...reportFixture().fundraising, actual: "280100" } });
    await GET(request("year=2026"));
    const response = await GET(request("year=2026"));
    expect((await response.json()).report.fundraising.actual).toBe("280100");
    expect(repo.read).toHaveBeenCalledTimes(2);
  });
});
