// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { OpportunityBoard } from "../../src/components/opportunities/opportunity-board";
import { BOARD_MAX, type BoardColumn } from "../../src/features/opportunities/board";
import type { OpportunityRecord, Stage } from "../../src/features/opportunities/types";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
afterEach(cleanup);

const stage = (id: string, name: string) =>
  ({ id, name, position: 1, active: true, is_closed: false, outcome: null, is_provisional: true }) as Stage;
const deal = (n: number) =>
  ({
    id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    deal_name: `Fictional deal ${n}`,
    expected_amount: 100,
    currency: "BDT",
    stage_id: "s1",
    expected_close_at: null,
    contact: { name: "Fictional Company" },
    owner: { display_name: "Fictional Member" },
  }) as unknown as OpportunityRecord;
const column = (id: string, name: string, deals: OpportunityRecord[], count: number, limit = 10): BoardColumn => ({
  stage: stage(id, name),
  deals,
  count,
  limit,
  totals: count
    ? new Map([
        ["BDT", BigInt(count) * 10000n],
        ["USD", 500n],
      ])
    : new Map(),
});
function board(columns: BoardColumn[]) {
  render(
    <OpportunityBoard
      columns={columns}
      stages={columns.map(c => c.stage)}
      canMove={() => false}
      moreHref={(id, limit) => `/more/${id}/${limit}`}
      stageListHref={id => `/list/${id}`}
    />,
  );
}

describe("stage board", () => {
  it("shows each stage's full count and totals, and offers more cards for that stage", () => {
    board([column("s1", "Prospecting", [deal(1), deal(2)], 37), column("s2", "Won", [], 0)]);
    const first = within(screen.getByRole("region", { name: /Prospecting/ }));
    expect(first.getByRole("heading").textContent).toBe("Prospecting 37");
    expect(first.getByText("BDT 3,700.00 · USD 5.00 expected")).toBeTruthy();
    expect(first.getByText("Showing 2 of 37")).toBeTruthy();
    expect(first.getByRole("link", { name: "Show 20 more in Prospecting" }).getAttribute("href")).toBe("/more/s1/30");
    const empty = within(screen.getByRole("region", { name: /Won/ }));
    expect(empty.getByText("No matching deals in this stage.")).toBeTruthy();
    expect(empty.queryByRole("link", { name: /Show/ })).toBeNull();
  });
  it("offers only what is left, nothing once all cards show, and the list past the board's limit", () => {
    board([
      column("s1", "Prospecting", [deal(1)], 6),
      column("s2", "Pledged", [deal(2)], 1),
      column("s3", "Pending", [deal(3)], 900, BOARD_MAX),
    ]);
    expect(screen.getByRole("link", { name: "Show 5 more in Prospecting" })).toBeTruthy();
    expect(within(screen.getByRole("region", { name: /Pledged/ })).queryByText(/Showing/)).toBeNull();
    expect(screen.getByRole("link", { name: "See all 900 Pending deals in the list" }).getAttribute("href")).toBe(
      "/list/s3",
    );
  });
});
