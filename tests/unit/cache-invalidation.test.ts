import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ tag: vi.fn(), path: vi.fn(), cache: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidateTag: mocks.tag, revalidatePath: mocks.path, unstable_cache: mocks.cache }));
vi.mock("../../src/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({ url: "https://example.supabase.co", key: "sb_publishable_fictional" }),
}));
import { invalidateReportCache, invalidateUserReportCache } from "../../src/lib/cache/invalidation";
import { cacheTags, projectCacheId } from "../../src/lib/cache/policy";
import { nextCacheBackend } from "../../src/lib/cache/server";
import { invalidateOpportunity, invalidateConfiguration } from "../../src/features/opportunities/api";
import { invalidateActivity } from "../../src/features/activities/api";
import { invalidateMeeting } from "../../src/features/meetings/api";
import { invalidateFinance } from "../../src/features/finance/context";
beforeEach(() => vi.clearAllMocks());
const tags = cacheTags(projectCacheId("https://example.supabase.co"), "user");
describe("Next tagged cache integration", () => {
  it("uses blocking expiry rather than stale-while-revalidate after writes", () => {
    invalidateReportCache(true);
    expect(mocks.tag).toHaveBeenCalledWith(tags.reports, { expire: 0 });
    expect(mocks.tag).toHaveBeenCalledWith(tags.verticals, { expire: 0 });
  });
  it.each([invalidateOpportunity, invalidateActivity, invalidateMeeting])(
    "invalidates report snapshots after operational writes",
    invalidate => {
      invalidate("record");
      expect(mocks.tag).toHaveBeenCalledWith(tags.reports, { expire: 0 });
      expect(mocks.path).toHaveBeenCalledWith("/reports", "layout");
    },
  );
  it("invalidates target/receipt reports and vertical metadata after finance changes", () => {
    invalidateFinance();
    expect(mocks.tag).toHaveBeenCalledWith(tags.reports, { expire: 0 });
    expect(mocks.tag).toHaveBeenCalledWith(tags.verticals, { expire: 0 });
  });
  it("invalidates pipeline configuration results and limits Refresh to the verified user", () => {
    invalidateConfiguration();
    expect(mocks.tag).toHaveBeenCalledWith(tags.reports, { expire: 0 });
    mocks.tag.mockClear();
    invalidateUserReportCache("user");
    expect(mocks.tag).toHaveBeenCalledExactlyOnceWith(tags.user, { expire: 0 });
  });
  it("delegates scope keys, tags and TTL to the supported Next Data Cache API", async () => {
    const load = vi.fn().mockResolvedValue("value");
    mocks.cache.mockImplementation(callback => callback);
    expect(await nextCacheBackend.get({ key: ["private-key"], tags: ["tag"], ttl: 30 }, load)).toBe("value");
    expect(mocks.cache).toHaveBeenCalledWith(load, ["private-key"], { revalidate: 30, tags: ["tag"] });
  });
});
