import { describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database.types";
vi.mock("server-only", () => ({}));
import {
  BOARD_CARDS,
  BOARD_MAX,
  boardStages,
  cardLimits,
  cardsParam,
  summarize,
} from "../../src/features/opportunities/board";
import { createOpportunityRepository } from "../../src/features/opportunities/queries";
import { opportunityFilterSchema } from "../../src/features/opportunities/schemas";
import { createOpportunitiesService } from "../../src/features/opportunities/service";
import type { OpportunityRepository, Stage } from "../../src/features/opportunities/types";

const open = "40000000-0000-4000-8000-000000000001",
  won = "40000000-0000-4000-8000-000000000002",
  retired = "40000000-0000-4000-8000-000000000003",
  member = "00000000-0000-4000-8000-000000000002";
const stage = (id: string, position: number, active = true) =>
  ({ id, name: `Stage ${position}`, position, active, is_closed: false, outcome: null }) as Stage;
const stages = [stage(open, 1), stage(won, 2), stage(retired, 3, false)];
const rows = [
  { stage_id: open, currency: "BDT", expected_amount: 1000.5 },
  { stage_id: open, currency: "BDT", expected_amount: "0.25" },
  { stage_id: open, currency: "USD", expected_amount: 300 },
  { stage_id: won, currency: "BDT", expected_amount: 10 },
];

describe("board helpers", () => {
  it("counts and totals every deal by stage and currency, never combining currencies", () => {
    const summary = summarize(rows);
    expect(summary.count).toBe(4);
    expect([...summary.totals]).toEqual([
      ["BDT", 101075n],
      ["USD", 30000n],
    ]);
    expect(summary.stages.get(open)).toEqual({
      count: 3,
      totals: new Map([
        ["BDT", 100075n],
        ["USD", 30000n],
      ]),
    });
  });
  it("reads per-stage card limits leniently and merges a new one", () => {
    const limits = cardLimits(`${open}:30,${won}:99999,junk,${retired.slice(1)}:40`);
    expect([...limits]).toEqual([[open, 30]]);
    expect(cardLimits(`${won}:9999`).get(won)).toBe(BOARD_MAX);
    expect(cardLimits(`${won}:3`).get(won)).toBe(BOARD_CARDS);
    expect(cardLimits(["a", "b"]).size).toBe(0);
    expect(cardsParam(limits, won, 30)).toBe(`${open}:30,${won}:30`);
    expect(cardsParam(limits, open, 50)).toBe(`${open}:50`);
  });
  it("shows active stages and inactive ones still in use, or only the filtered stage", () => {
    const used = summarize([...rows, { stage_id: retired, currency: "BDT", expected_amount: 1 }]);
    expect(boardStages(stages, summarize(rows)).map(s => s.id)).toEqual([open, won]);
    expect(boardStages(stages, used).map(s => s.id)).toEqual([open, won, retired]);
    expect(boardStages(stages, summarize(rows.filter(r => r.stage_id === won)), won).map(s => s.id)).toEqual([won]);
  });
});

function repository(pages: unknown[][]) {
  const fetcher = vi.fn().mockImplementation(
    async () =>
      new Response(JSON.stringify(pages.shift() ?? []), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );
  const client = createClient<Database>("https://example.supabase.co", "sb_publishable_fictional", {
    global: { fetch: fetcher },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { fetcher, repo: createOpportunityRepository(client) };
}
const filters = opportunityFilterSchema.parse({ owner_id: member, currency: "bdt", page: 4 });

describe("board queries", () => {
  it("reads the summary in 1,000-row chunks with the list filters until a short chunk", async () => {
    const full = Array.from({ length: 1000 }, () => rows[0]);
    const { repo, fetcher } = repository([full, rows.slice(0, 2)]);
    expect(await repo.summary(filters)).toHaveLength(1002);
    const urls = fetcher.mock.calls.map(([url]) => new URL(url));
    expect(urls.map(u => [u.searchParams.get("offset"), u.searchParams.get("limit")])).toEqual([
      ["0", "1000"],
      ["1000", "1000"],
    ]);
    expect(urls[0].searchParams.get("select")).toBe("stage_id,currency,expected_amount");
    expect(urls[0].searchParams.get("owner_id")).toBe(`eq.${member}`);
    expect(urls[0].searchParams.get("currency")).toBe("eq.BDT");
    expect(urls[0].searchParams.get("order")).toBe("id.asc");
  });
  it("reads a stage's latest cards up to its limit", async () => {
    const { repo, fetcher } = repository([[]]);
    await repo.stageCards(filters, won, 30);
    const url = new URL(fetcher.mock.calls[0][0]);
    expect(url.searchParams.get("stage_id")).toBe(`eq.${won}`);
    expect(url.searchParams.get("owner_id")).toBe(`eq.${member}`);
    expect(url.searchParams.get("limit")).toBe("30");
    expect(url.searchParams.get("order")).toBe("created_at.desc,id.asc");
  });
});

describe("board service", () => {
  const access = {
    status: "allowed" as const,
    userId: member,
    profile: {
      id: member,
      display_name: "Fictional Member",
      department: "PSE",
      role: "pse_member" as const,
      active: true,
    },
  };
  it("loads cards only for stages with deals, at each stage's limit", async () => {
    const stageCards = vi.fn().mockResolvedValue([]);
    const repo = {
      summary: vi.fn().mockResolvedValue(rows.filter(r => r.stage_id === open)),
      options: vi.fn().mockResolvedValue({ stages, categories: [], owners: [] }),
      stageCards,
    } as unknown as OpportunityRepository;
    const board = await createOpportunitiesService(repo, access).board({ page: "3" }, `${open}:30`);
    expect(board.columns.map(c => [c.stage.id, c.count, c.limit])).toEqual([
      [open, 3, 30],
      [won, 0, BOARD_CARDS],
    ]);
    expect(stageCards).toHaveBeenCalledTimes(1);
    expect(stageCards).toHaveBeenCalledWith(expect.not.objectContaining({ page: expect.anything() }), open, 30);
  });
  it("denies anonymous access before reading", async () => {
    const repo = { summary: vi.fn(), options: vi.fn() } as unknown as OpportunityRepository;
    await expect(createOpportunitiesService(repo, { status: "anonymous" }).board({})).rejects.toMatchObject({
      status: 401,
    });
    expect(repo.summary).not.toHaveBeenCalled();
  });
});
