import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
vi.mock("server-only", () => ({}));
import { createOpportunityRepository } from "../../src/features/opportunities/queries";
import { opportunityListSchema } from "../../src/features/opportunities/schemas";

function repository(body: unknown = [], status = 200) {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
      }),
  );
  return {
    fetcher,
    repo: createOpportunityRepository(
      createClient<Database>("https://example.supabase.co", "sb_publishable_fictional", {
        global: { fetch: fetcher },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    ),
  };
}
const id = "10000000-0000-4000-8000-000000000001";
describe("Supabase opportunity query contracts", () => {
  it("applies bounded pagination, literal search, filters and related contact selection", async () => {
    const { repo, fetcher } = repository();
    const q = 'Fictional, "quote"_%';
    await repo.list(
      opportunityListSchema.parse({
        q,
        page: 2,
        stage_id: id,
        owner_id: id,
        currency: "usd",
        from: "2026-01-01",
        to: "2026-12-31",
        contact_id: id,
      }),
    );
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("offset")).toBe("20");
    expect(url.searchParams.get("limit")).toBe("20");
    expect(url.searchParams.get("order")).toBe("created_at.desc,id.asc");
    expect(url.searchParams.get("currency")).toBe("eq.USD");
    expect(url.searchParams.getAll("expected_close_at")).toEqual(["gte.2026-01-01", "lte.2026-12-31"]);
    expect(url.searchParams.get("deal_name")).toBe(`ilike.%${q.replace(/[\\%_]/g, character => `\\${character}`)}%`);
    expect(url.searchParams.get("or")).toContain(`secondary_contact_id.eq.${id}`);
    expect(url.searchParams.get("select")).toContain("primary_contact:primary_contact_id");
  });
  it("loads stage/category data and permitted PSE profiles without hiding historical inactive selections", async () => {
    const { repo, fetcher } = repository();
    await repo.options();
    const urls = fetcher.mock.calls.map(([url]) => new URL(url));
    expect(urls).toHaveLength(3);
    expect(urls[0].searchParams.get("active")).toBeNull();
    expect(urls[2].searchParams.get("department")).toBe("eq.PSE");
    expect(urls[2].searchParams.get("select")).toBe("id,display_name,active");
  });
  it("bounds recognized and audit history to the requested opportunity", async () => {
    const { repo, fetcher } = repository();
    await repo.history(id);
    const urls = fetcher.mock.calls.map(([url]) => new URL(url));
    expect(urls[0].searchParams.get("opportunity_id")).toBe(`eq.${id}`);
    expect(urls[0].searchParams.get("limit")).toBe("10");
    expect(urls[1].searchParams.get("entity")).toBe("eq.opportunities");
    expect(urls[1].searchParams.get("entity_id")).toBe(`eq.${id}`);
    expect(urls[1].searchParams.get("limit")).toBe("20");
  });
  it.each([
    ["42501", 403],
    ["23514", 422],
    ["23505", 409],
    ["XX000", 503],
  ])("scrubs provider failure %s", async (code, expected) => {
    const error = await repository({ code, message: "Sensitive database internals" }, 400)
      .repo.find(id)
      .catch(error => error);
    expect(error.status).toBe(expected);
    expect(error.message).not.toContain("Sensitive");
  });
  it("targets only one record when editing a stage", async () => {
    const { repo, fetcher } = repository({ id });
    await repo.saveStage(
      { name: "Fictional stage", position: 25, outcome: null, is_closed: false, active: false, is_provisional: true },
      id,
    );
    expect(fetcher.mock.calls[0][1].method).toBe("PATCH");
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("id")).toBe(`eq.${id}`);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ active: false, is_closed: false });
  });
  it("deletes only the requested opportunity and checks the returned row", async () => {
    const { repo, fetcher } = repository({ id });
    expect(await repo.remove(id)).toBe(true);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("id")).toBe(`eq.${id}`);
    expect(url.searchParams.get("select")).toBe("id");
    expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
    expect(await repository(null).repo.remove(id)).toBe(false);
  });
  it.each(["23503", "23001"])("maps referenced-opportunity delete code %s to a safe 409", async code => {
    const error = await repository({ code, message: "Sensitive constraint internals" }, 409)
      .repo.remove(id)
      .catch(error => error);
    expect(error.status).toBe(409);
    expect(error.message).toContain("recognized contributions");
    expect(error.message).not.toContain("Sensitive");
  });
});
