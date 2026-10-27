// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContributionForm } from "../../src/components/finance/contribution-form";
import { TargetForm } from "../../src/components/finance/target-form";
import { ApproveTarget } from "../../src/components/finance/approve-target";
import type { FinanceOptions } from "../../src/features/finance/types";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const member = "00000000-0000-4000-8000-000000000002",
  vertical = "50000000-0000-4000-8000-000000000001",
  id = "f1000000-0000-4000-8000-000000000001";
const options: FinanceOptions = {
  employees: [{ id: member, display_name: "Fictional Employee", active: true }],
  verticals: [
    {
      id: vertical,
      code: "TEST",
      name: "Fictional Vertical",
      active: true,
      is_provisional: true,
      created_at: "",
      updated_at: "",
    },
  ],
};
const opportunity = { id, deal_name: "Fictional Deal", owner_id: member, currency: "BDT", contribution_type: "cash" };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({ contribution: { id }, id }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function receipt(type = "cash") {
  render(
    <ContributionForm opportunity={{ ...opportunity, contribution_type: type }} options={options} userId={member} />,
  );
  fireEvent.change(screen.getByLabelText("Actual amount received / agreed value *"), { target: { value: "100.01" } });
  fireEvent.change(screen.getByLabelText("Recognition date/time (Asia/Dhaka) *"), {
    target: { value: "2026-10-27T10:30" },
  });
}
describe("contribution review and persistence", () => {
  it("starts without copying the expected amount and requires confirmation", async () => {
    receipt();
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    expect(await screen.findByText("Confirm this financial entry")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("records the manually entered amount, attribution and Dhaka recognition time", async () => {
    receipt();
    fireEvent.change(screen.getByLabelText("Target vertical (optional)"), { target: { value: vertical } });
    fireEvent.change(screen.getByLabelText("Notes / receipt references (optional)"), {
      target: { value: "Fictional receipt" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and record contribution" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/contributions/${id}`));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      amount: "100.01",
      recognized_at: "2026-10-27T04:30:00.000Z",
      employee_id: member,
      target_vertical_id: vertical,
      notes: "Fictional receipt",
    });
  });
  it("requires agreed valuation context for in-kind", async () => {
    receipt("valued_in_kind");
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Agreed valuation and operational-team estimate source *"), {
      target: { value: "Fictional agreed operational-team inventory estimate" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    expect(await screen.findByText("Confirm this financial entry")).toBeTruthy();
  });
  it("freezes ambiguous writes and retries the identical submission ID/payload", async () => {
    fetcher.mockRejectedValueOnce(new Error("Connection lost"));
    receipt();
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and record contribution" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Back to edit" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry same submission" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][1].body).toBe(fetcher.mock.calls[1][1].body);
  });
});
describe("target entry and locked approval", () => {
  it("saves incomplete drafts without approving them", async () => {
    render(<TargetForm options={options} year={2026} />);
    fireEvent.change(screen.getByLabelText("Annual target *"), { target: { value: "1000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/targets/${id}`));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      annual_amount: "1000",
      quarters: [1, 2, 3, 4].map(quarter => ({ quarter, amount: "0.00" })),
      allocations: [],
      expected_updated_at: "",
    });
  });
  it("calculates percentages in cents and displays the unallocated remainder", () => {
    render(<TargetForm options={options} year={2026} />);
    fireEvent.change(screen.getByLabelText("Annual target *"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Q1 target"), { target: { value: "10" } });
    fireEvent.click(screen.getByRole("button", { name: "Add allocation" }));
    fireEvent.change(screen.getByLabelText("Allocation 1 percentage"), { target: { value: "33.33" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply percentage" }));
    expect((screen.getByLabelText("Allocation 1 amount") as HTMLInputElement).value).toBe("3.33");
    expect(screen.getByText("Q1 left to allocate: 6.67 BDT")).toBeTruthy();
  });
  it("preserves entered amounts after a stale-version conflict", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "Draft has changed. Reload and review." }, { status: 409 }));
    render(<TargetForm options={options} year={2026} />);
    fireEvent.change(screen.getByLabelText("Annual target *"), { target: { value: "1500" } });
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Draft has changed");
    expect((screen.getByLabelText("Annual target *") as HTMLInputElement).value).toBe("1500");
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it("requires explicit lock acknowledgement and sends the reviewed version", async () => {
    render(<ApproveTarget id={id} stamp="2026-10-27T04:00:00Z" />);
    const button = screen.getByRole("button", { name: "Approve and lock targets" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(button);
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ expected_updated_at: "2026-10-27T04:00:00Z" });
  });
  it("shows failed reconciliation and keeps the plan unlocked", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "Q1 allocations must reconcile." }, { status: 422 }));
    render(<ApproveTarget id={id} stamp="2026-10-27T04:00:00Z" />);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Approve and lock targets" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Q1 allocations");
    expect(navigation.refresh).not.toHaveBeenCalled();
  });
});
