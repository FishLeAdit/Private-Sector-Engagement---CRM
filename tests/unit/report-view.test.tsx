// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ReportView } from "../../src/components/reports/view";
import { reportFixture } from "../helpers/report-fixture";
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ refreshed: true })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const filters = { year: 2026, period: "year" as const, employee_id: "", vertical_id: "", currency: "BDT" };
const options = {
  employees: [{ id: "employee", display_name: "Fictional Employee", active: true }],
  verticals: [{ id: "vertical", name: "Fictional provisional vertical", active: true, is_provisional: true }],
};
describe("detailed reporting view", () => {
  it("keeps refresh failures visible instead of refreshing stale data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Denied" }, { status: 403 })));
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Refresh failed");
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
  it("separates actual achievement, forecast and workload with draft-target labels", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    for (const name of ["Monetary fundraising", "Pipeline forecast", "Non-monetary work"])
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    expect(screen.getByText("Actual achievement")).toBeTruthy();
    expect(screen.getAllByText("BDT 280,000.00").length).toBeGreaterThan(0);
    expect(screen.getAllByText("BDT 500,000.00").length).toBeGreaterThan(0);
    expect(screen.getByText("Draft target")).toBeTruthy();
    expect(screen.getByText(/Targets are provisional until/)).toBeTruthy();
  });
  it("shows actuals without fabricated monthly quotas or percentages", () => {
    const r = reportFixture();
    r.fundraising.target = null;
    r.fundraising.dimensions = [];
    render(<ReportView filters={{ ...filters, period: "m03" }} report={r} options={options} />);
    expect(screen.getByText(/Monthly targets have not been assigned/)).toBeTruthy();
    expect(screen.getAllByText("Not applicable").length).toBeGreaterThan(0);
    expect(screen.queryByText("28.00%")).toBeNull();
  });
  it("keeps its filters and links back to the overview for the same period", () => {
    render(
      <ReportView
        filters={{ ...filters, period: "q1", vertical_id: "unassigned" }}
        report={reportFixture()}
        options={options}
      />,
    );
    // The overview is always the whole team, so only the year, period and currency carry over.
    const link = screen.getByRole("link", { name: "Dashboard overview" });
    const url = new URL(link.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/dashboard");
    expect(url.searchParams.get("period")).toBe("q1");
    expect(url.searchParams.has("vertical_id")).toBe(false);
    expect((screen.getByLabelText("Period") as HTMLSelectElement).value).toBe("q1");
    expect((screen.getByLabelText("Funding vertical") as HTMLSelectElement).value).toBe("unassigned");
  });
  it("shows full tables, unassigned funding and separate owner completion counts", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    for (const caption of ["Employee / vertical fundraising", "All matching stages", "Work by owner", "Monthly trends"])
      expect(screen.getByRole("table", { name: caption })).toBeTruthy();
    expect(screen.getByText("Unassigned")).toBeTruthy();
    expect(screen.getByText(/Meeting-type activities and canonical meetings are separate/)).toBeTruthy();
  });
  it("explains undated work, missing legacy context and unapproved KPIs", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    expect(screen.getByText(/older independent activity needs/)).toBeTruthy();
    expect(screen.getByText(/Undated activities across all dates/)).toBeTruthy();
    expect(screen.getByText(/Lead and follow-up-rate KPIs are awaiting/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Leads" })).toBeNull();
  });
  it("shows contacts engaged as a provisional figure, with owners", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    const section = screen.getByRole("region", { name: "Contacts engaged" });
    expect(section.textContent).toContain("Provisional — awaiting PSE definition");
    expect(section.textContent).toContain("Named, unlinked interactions");
    const table = screen.getByRole("table", { name: "Contacts engaged by owner" });
    expect(table.textContent).toContain("Fictional Employee");
    expect(table.textContent).toContain("5");
  });
  it("hides contacts engaged for a snapshot made before the figures existed", () => {
    const r = reportFixture();
    delete r.engagement;
    render(<ReportView filters={filters} report={r} options={options} />);
    expect(screen.queryByRole("heading", { name: "Contacts engaged" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Non-monetary work" })).toBeTruthy();
  });
  it("refreshes current data and renders chart values as accessible text", async () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalledTimes(1));
    expect(screen.getAllByRole("figure").length).toBeGreaterThan(4);
    expect(screen.getByText("Fictional configurable stage (provisional)")).toBeTruthy();
  });
  it("shows quarter and pace charts for a full-year report, with every value in the figure's table", () => {
    const quarters = [
      { quarter: 1, target: "150000.00", actual: "165000.00" },
      { quarter: 2, target: "250000.00", actual: "40000.00" },
      { quarter: 3, target: "250000.00", actual: null },
      { quarter: 4, target: "350000.00", actual: null },
    ];
    render(<ReportView filters={filters} report={reportFixture()} options={options} quarters={quarters} />);
    const byQuarter = screen.getByRole("figure", { name: "Target vs actual by quarter" });
    expect(within(byQuarter).getByRole("row", { name: /Q1 BDT 150,000.00 BDT 165,000.00 110%/ })).toBeTruthy();
    expect(within(byQuarter).getByRole("row", { name: /Q3 BDT 250,000.00 Not started/ })).toBeTruthy();
    const pace = screen.getByRole("figure", { name: "Year pace, cumulative" });
    expect(within(pace).getByRole("row", { name: /Q2 BDT 400,000.00 BDT 205,000.00/ })).toBeTruthy();
    expect(within(pace).getByRole("row", { name: /Q4 BDT 1,000,000.00 Not started/ })).toBeTruthy();
  });
  it("leaves quarter charts out without quarter data and indexes the sections", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    expect(screen.queryByRole("figure", { name: "Target vs actual by quarter" })).toBeNull();
    const index = screen.getByRole("navigation", { name: "Report sections" });
    expect(
      within(index)
        .getAllByRole("link")
        .map(link => link.getAttribute("href")),
    ).toEqual(["#fundraising", "#pipeline", "#workload", "#engagement", "#definitions"]);
  });
  it("highlights Won among outcomes and keeps every outcome readable", () => {
    render(<ReportView filters={filters} report={reportFixture()} options={options} />);
    const outcomes = screen.getByRole("figure", { name: "Deals by current outcome" });
    expect(within(outcomes).getByRole("row", { name: /Open 2 BDT 500,000.00/ })).toBeTruthy();
    expect(outcomes.textContent).toContain("Won");
  });
});
