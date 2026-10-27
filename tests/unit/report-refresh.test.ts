import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), invalidate: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/auth/access", () => ({ authorizeApi: mocks.authorize }));
vi.mock("../../src/lib/cache/invalidation", () => ({ invalidateUserReportCache: mocks.invalidate }));
import { POST } from "../../src/app/api/reports/refresh/route";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authorize.mockResolvedValue({ ok: true, access: { userId: "verified-user" } });
});
const request = (origin = "http://localhost") =>
  new Request("http://localhost/api/reports/refresh", { method: "POST", headers: { Origin: origin } });
describe("private report refresh", () => {
  it.each([401, 403, 503])("denies auth state %s before invalidation", async status => {
    mocks.authorize.mockResolvedValue({ ok: false, response: NextResponse.json({ error: "Denied" }, { status }) });
    expect((await POST(request())).status).toBe(status);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it.each(["", "https://evil.invalid"])("requires same Origin %s", async origin => {
    expect((await POST(request(origin))).status).toBe(403);
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("expires the verified user's entries and returns private/no-store headers", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith("verified-user");
  });
  it("returns a safe failure rather than claiming refresh completed", async () => {
    mocks.invalidate.mockImplementationOnce(() => {
      throw new Error("Private cache detail");
    });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("Private cache detail");
  });
});
