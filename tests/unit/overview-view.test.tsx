// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { OverviewData } from "../../src/features/overview/context";
import { OverviewView } from "../../src/components/overview/overview-view";
import { dhakaDate } from "../../src/lib/dates";
import { reportFixture } from "../helpers/report-fixture";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
afterEach(cleanup);

const me = "00000000-0000-4000-8000-000000000002";
const meeting = (n: number) => ({
  id: `30000000-0000-4000-8000-00000000000${n}`,
  title: `Fictional meeting ${n}`,
  scheduled_at: `2026-11-0${n}T04:00:00Z`,
  contact: { name: `Fictional contact ${n}` },
  opportunity: null,
});
function overview(overrides: Partial<OverviewData> = {}): OverviewData {
  return {
    filters: { year: 2026, period: "year", employee_id: "", vertical_id: "", currency: "BDT" },
    report: reportFixture(),
    quarters: [
      { quarter: 1, target: "150000.00", actual: "165000.00" },
      { quarter: 2, target: "250000.00", actual: null },
      { quarter: 3, target: null, actual: null },
      { quarter: 4, target: null, actual: null },
    ],
    me,
    closingWindow: { from: "2026-10-29", to: "2026-11-28" },
    upcoming: { ok: true, data: { meetings: [1, 2, 3, 4, 5, 6, 7].map(meeting), count: 7 } },
    openWork: { ok: false, message: "Activities are temporarily unavailable. Please try again." },
    receipts: {
      ok: true,
      data: {
        contributions: [
          {
            id: "90000000-0000-4000-8000-000000000001",
            amount: 165000,
            currency: "BDT",
            recognized_at: "2026-03-20T04:00:00Z",
            opportunity: { id: "o", deal_name: "Fictional sponsorship" },
            employee: { display_name: "Fictional Employee" },
          },
        ],
        count: 1,
      },
    },
    closing: { ok: true, data: [] },
    contactCount: { ok: true, data: 13 },
    ...overrides,
  } as unknown as OverviewData;
}

describe("overview dashboard", () => {
  it("leads with the team's two lenses, then the user's queue", () => {
    render(<OverviewView data={overview()} />);
    expect(screen.getByRole("heading", { level: 1, name: "PSE overview" })).toBeTruthy();
    for (const name of ["Monetary fundraising", "Non-monetary work", "Your queue and recent activity"])
      expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
    expect(screen.getByText("Actual achievement")).toBeTruthy();
    // The hero figure reads as one amount, with its currency as a unit beside the number.
    expect(screen.getByText("Actual achievement").nextElementSibling?.textContent).toBe("BDT 280,000.00");
    expect(screen.getByRole("figure", { name: "Year pace, cumulative" })).toBeTruthy();
    expect(screen.getByText("Provisional — awaiting PSE definition")).toBeTruthy();
  });
  it("falls back to monthly receipts when there is no quarter breakdown", () => {
    render(<OverviewView data={overview({ quarters: null })} />);
    expect(screen.queryByRole("figure", { name: "Year pace, cumulative" })).toBeNull();
    expect(screen.getByRole("figure", { name: "Recognized achievement by month" })).toBeTruthy();
  });
  it("shows the first five queue items with the full count and a filtered link to the rest", () => {
    render(<OverviewView data={overview()} />);
    const meetings = screen.getByRole("region", { name: "My upcoming meetings" });
    expect(within(meetings).getAllByRole("listitem")).toHaveLength(5);
    expect(within(meetings).getByRole("heading").textContent).toContain("7");
    expect(within(meetings).getByRole("link", { name: "View all" }).getAttribute("href")).toBe(
      `/meetings?period=upcoming&owner_id=${me}`,
    );
  });
  it("keeps a failed panel's problem inside that panel and still renders the others", () => {
    render(<OverviewView data={overview()} />);
    const work = screen.getByRole("region", { name: "My open activities" });
    expect(within(work).getByRole("alert").textContent).toContain("temporarily unavailable");
    expect(
      within(screen.getByRole("region", { name: "Recent contributions" })).getByText("BDT 165,000.00"),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("region", { name: "Deals closing in 30 days" })).getByText(
        "No open deals are expected to close in the next 30 days.",
      ),
    ).toBeTruthy();
  });
  it("links to the detailed reports for the same year, period and currency", () => {
    render(<OverviewView data={overview()} />);
    const url = new URL(screen.getByRole("link", { name: "Detailed reports" }).getAttribute("href")!, "http://x");
    expect(url.pathname).toBe("/reports");
    expect(Object.fromEntries(url.searchParams)).toEqual({ year: "2026", period: "year", currency: "BDT" });
  });
});

describe("Dhaka calendar dates", () => {
  it("uses the Dhaka day, not the UTC one, and counts days ahead", () => {
    // 20:00 UTC on 28 October is 02:00 on 29 October in Dhaka.
    expect(dhakaDate(new Date("2026-10-28T20:00:00Z"))).toBe("2026-10-29");
    expect(dhakaDate(new Date("2026-10-28T20:00:00Z"), 30)).toBe("2026-11-28");
  });
});
