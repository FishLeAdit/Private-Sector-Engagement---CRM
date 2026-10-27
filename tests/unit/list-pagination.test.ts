import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
vi.mock("server-only", () => ({}));
import { createContactRepository } from "../../src/features/contacts/queries";
import { contactListSchema } from "../../src/features/contacts/schemas";
import { createOpportunityRepository } from "../../src/features/opportunities/queries";
import { opportunityListSchema } from "../../src/features/opportunities/schemas";
import { createMeetingRepository } from "../../src/features/meetings/queries";
import { meetingListSchema } from "../../src/features/meetings/schemas";
import { createActivityRepository } from "../../src/features/activities/queries";
import { activityListSchema } from "../../src/features/activities/schemas";
import { createContributionRepository } from "../../src/features/contributions/queries";
import { contributionFilters } from "../../src/features/contributions/schemas";
import { createTargetRepository } from "../../src/features/targets/queries";

const TOTAL = 37;

// Mimics PostgREST: a page starting past the last row is rejected with 416/PGRST103 and no count.
function pastEndClient({ firstPageFails = false } = {}) {
  const fetcher = vi.fn().mockImplementation(async (input: string | URL) => {
    const offset = Number(new URL(String(input)).searchParams.get("offset") ?? 0);
    if (offset >= TOTAL || firstPageFails)
      return Response.json(
        {
          code: "PGRST103",
          details: `An offset of ${offset} was requested, but there are only ${TOTAL} rows.`,
          hint: null,
          message: "Requested range not satisfiable",
        },
        { status: 416 },
      );
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": `0-19/${TOTAL}` },
    });
  });
  const client = createClient<Database>("https://example.supabase.co", "sb_publishable_fictional", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { client, fetcher };
}

// Every request after the first must repeat the same filters and only drop back to the first page.
function expectRetriedOnFirstPage(fetcher: ReturnType<typeof vi.fn>) {
  expect(fetcher).toHaveBeenCalledTimes(2);
  const [first, retry] = fetcher.mock.calls.map(call => new URL(String(call[0])).searchParams);
  expect(Number(first.get("offset"))).toBeGreaterThanOrEqual(TOTAL);
  expect(retry.get("offset") ?? "0").toBe("0");
  first.delete("offset");
  retry.delete("offset");
  expect(retry.toString()).toBe(first.toString());
}

const cases: [string, (client: ReturnType<typeof pastEndClient>["client"], page: number) => Promise<unknown>][] = [
  [
    "contacts",
    (client, page) => createContactRepository(client).list(contactListSchema.parse({ page, kind: "company" })),
  ],
  [
    "opportunities",
    (client, page) =>
      createOpportunityRepository(client).list(opportunityListSchema.parse({ page, currency: "BDT", q: "fund" })),
  ],
  [
    "meetings",
    (client, page) =>
      createMeetingRepository(client).list(meetingListSchema.parse({ page, status: "done" }), "2026-10-28T00:00:00Z"),
  ],
  [
    "activities",
    (client, page) =>
      createActivityRepository(client).list(activityListSchema.parse({ page, status: "open", activity_type: "visit" })),
  ],
  [
    "contributions",
    (client, page) =>
      createContributionRepository(client).contributions(contributionFilters.parse({ page, currency: "BDT" })),
  ],
  ["target plans", (client, page) => createTargetRepository(client).plans(page)],
];

describe("a list page past the last one", () => {
  it.each(cases)("%s: returns no rows with the real total so the page can redirect", async (_name, list) => {
    const { client, fetcher } = pastEndClient();
    const result = (await list(client, 5)) as Record<string, unknown>;
    expect(result.count).toBe(TOTAL);
    expect(Object.values(result).find(Array.isArray)).toEqual([]);
    expectRetriedOnFirstPage(fetcher);
  });

  it.each(cases)("%s: a failure on the first page is still reported, not retried", async (_name, list) => {
    const { client, fetcher } = pastEndClient({ firstPageFails: true });
    await expect(list(client, 1)).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
