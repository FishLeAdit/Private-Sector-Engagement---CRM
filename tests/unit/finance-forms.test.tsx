// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContributionForm } from "../../src/components/contributions/contribution-form";
import { TargetForm } from "../../src/components/targets/target-form";
import { ApproveTarget } from "../../src/components/targets/approve-target";
import type { FinanceOptions } from "../../src/features/finance/types";
import type { TargetInput } from "../../src/features/targets/schemas";
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
    <ContributionForm
      opportunity={{ ...opportunity, contribution_type: type }}
      options={options}
      userId={member}
      manager={false}
    />,
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
  it("credits a member's contribution to the member, with no employee choice", async () => {
    const colleague = "00000000-0000-4000-8000-000000000003";
    const team = {
      ...options,
      employees: [...options.employees, { id: colleague, display_name: "Colleague", active: true }],
    };
    // The deal belongs to a colleague, but a member still cannot credit anyone else.
    render(
      <ContributionForm
        opportunity={{ ...opportunity, owner_id: colleague }}
        options={team}
        userId={member}
        manager={false}
      />,
    );
    const field = screen.getByLabelText("Attributed employee *") as HTMLInputElement;
    expect(field.readOnly).toBe(true);
    expect(field.value).toBe("Fictional Employee");
    expect(screen.queryByRole("combobox", { name: "Attributed employee *" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Actual amount received / agreed value *"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("Recognition date/time (Asia/Dhaka) *"), {
      target: { value: "2026-10-27T10:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Review contribution" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirm and record contribution" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body).employee_id).toBe(member);
  });
  it("lets a manager credit any active employee, starting from the deal's focal person", async () => {
    const colleague = "00000000-0000-4000-8000-000000000003";
    const team = {
      ...options,
      employees: [...options.employees, { id: colleague, display_name: "Colleague", active: true }],
    };
    render(
      <ContributionForm opportunity={{ ...opportunity, owner_id: colleague }} options={team} userId={member} manager />,
    );
    const select = screen.getByRole("combobox", { name: "Attributed employee *" }) as HTMLSelectElement;
    expect(select.value).toBe(colleague);
    fireEvent.change(select, { target: { value: member } });
    expect(select.value).toBe(member);
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
});

describe("member amounts split across verticals by percentage", () => {
  const vbd = "50000000-0000-4000-8000-000000000002",
    colleague = "00000000-0000-4000-8000-000000000003";
  const team: FinanceOptions = {
    employees: [...options.employees, { id: colleague, display_name: "Fictional Colleague", active: true }],
    verticals: [...options.verticals, { ...options.verticals[0], id: vbd, code: "VBD", name: "Second Vertical" }],
  };
  const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
  const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });
  // The calculated amount shown under a percentage box.
  const shown = (label: string) => document.getElementById(field(label).getAttribute("aria-describedby")!)!.textContent;
  const saved = () => JSON.parse(fetcher.mock.calls[0][1].body).allocations;
  const save = () => fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  const draft = (allocations: TargetInput["allocations"]): TargetInput => ({
    request_id: id,
    expected_updated_at: "2026-10-27T04:00:00Z",
    year: 2026,
    currency: "BDT",
    annual_amount: "1000",
    quarters: [1, 2, 3, 4].map(quarter => ({ quarter, amount: "250" })),
    allocations,
  });

  it("splits each member's amount by vertical percentage and saves the calculated cells", async () => {
    render(<TargetForm options={team} year={2026} />);
    type("Annual target *", "1000");
    type("Q1 target", "1000");
    type("Q1 Fictional Employee amount", "600");
    type("Q1 Fictional Employee Fictional Vertical %", "50");
    expect(screen.getByText("50% (50% left)")).toBeTruthy();
    type("Q1 Fictional Employee Second Vertical %", "50");
    expect(shown("Q1 Fictional Employee Fictional Vertical %")).toBe("300.00");
    expect(shown("Q1 Fictional Employee Second Vertical %")).toBe("300.00");
    expect(
      screen.getByText("Q1 target BDT 1,000.00 · allocated to members BDT 600.00 · left to allocate BDT 400.00"),
    ).toBeTruthy();
    save();
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(saved()).toEqual([
      { quarter: 1, employee_id: member, vertical_id: vertical, amount: "300.00" },
      { quarter: 1, employee_id: member, vertical_id: vbd, amount: "300.00" },
    ]);
  });
  it("puts leftover cents on the member's last vertical so the cells add up", async () => {
    render(<TargetForm options={team} year={2026} />);
    type("Annual target *", "1");
    type("Q1 Fictional Employee amount", "0.05");
    type("Q1 Fictional Employee Fictional Vertical %", "50");
    type("Q1 Fictional Employee Second Vertical %", "50");
    expect(shown("Q1 Fictional Employee Fictional Vertical %")).toBe("0.02");
    expect(shown("Q1 Fictional Employee Second Vertical %")).toBe("0.03");
    save();
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(saved().map((cell: { amount: string }) => cell.amount)).toEqual(["0.02", "0.03"]);
  });
  it("blocks saving until a member's split totals 100%", () => {
    render(<TargetForm options={team} year={2026} />);
    type("Annual target *", "1000");
    type("Q1 Fictional Employee amount", "600");
    type("Q1 Fictional Employee Fictional Vertical %", "60");
    expect(screen.getByText("60% (40% left)")).toBeTruthy();
    save();
    expect(screen.getByRole("alert").textContent).toContain(
      "Q1 · Fictional Employee: the vertical split totals 60%; it must total 100%.",
    );
    type("Q1 Fictional Employee Fictional Vertical %", "150");
    expect(screen.getAllByRole("alert").some(alert => alert.textContent?.includes("Use 0–100"))).toBe(true);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("asks for the member's amount when only percentages are entered", () => {
    render(<TargetForm options={team} year={2026} />);
    type("Annual target *", "1000");
    type("Q1 Fictional Colleague Second Vertical %", "100");
    save();
    expect(screen.getByRole("alert").textContent).toContain(
      "Q1 · Fictional Colleague: enter the member's amount for this quarter.",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("re-saves an untouched draft's cells exactly, even when percentages cannot express them", async () => {
    const cells = [
      { quarter: 1, employee_id: member, vertical_id: vertical, amount: "100.01" },
      { quarter: 1, employee_id: member, vertical_id: vbd, amount: "200.00" },
      { quarter: 2, employee_id: colleague, vertical_id: vertical, amount: "250.00" },
    ];
    render(<TargetForm initial={draft(cells)} options={team} year={2026} />);
    expect(field("Q1 Fictional Employee amount").value).toBe("300.01");
    expect(field("Q1 Fictional Employee Fictional Vertical %").value).toBe("33.34");
    expect(field("Q1 Fictional Employee Second Vertical %").value).toBe("66.66");
    expect(shown("Q1 Fictional Employee Fictional Vertical %")).toBe("100.01");
    fireEvent.click(screen.getByRole("button", { name: "Q2" }));
    expect(field("Q2 Fictional Colleague amount").value).toBe("250.00");
    expect(field("Q2 Fictional Colleague Fictional Vertical %").value).toBe("100");
    save();
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(saved()).toEqual(cells);
  });
  it("recalculates a member's cells from amount and percentages once the row is edited", async () => {
    const cells = [
      { quarter: 1, employee_id: member, vertical_id: vertical, amount: "100.01" },
      { quarter: 1, employee_id: member, vertical_id: vbd, amount: "200.00" },
    ];
    render(<TargetForm initial={draft(cells)} options={team} year={2026} />);
    type("Q1 Fictional Employee Fictional Vertical %", "50");
    type("Q1 Fictional Employee Second Vertical %", "50");
    save();
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(saved()).toEqual([
      { quarter: 1, employee_id: member, vertical_id: vertical, amount: "150.00" },
      { quarter: 1, employee_id: member, vertical_id: vbd, amount: "150.01" },
    ]);
  });
  it("keeps member amounts when a quarter target changes and updates what is left", () => {
    render(
      <TargetForm
        initial={draft([{ quarter: 1, employee_id: member, vertical_id: vertical, amount: "250.00" }])}
        options={team}
        year={2026}
      />,
    );
    type("Q1 target", "400");
    expect(field("Q1 Fictional Employee amount").value).toBe("250.00");
    expect(
      screen.getByText("Q1 target BDT 400.00 · allocated to members BDT 250.00 · left to allocate BDT 150.00"),
    ).toBeTruthy();
    type("Q1 target", "200");
    expect(
      screen.getByText("Q1 target BDT 200.00 · allocated to members BDT 250.00 · over-allocated by BDT 50.00"),
    ).toBeTruthy();
  });
  it("shows an inactive member only while a saved share still uses them", () => {
    const inactive: FinanceOptions = {
      ...team,
      employees: [team.employees[0], { ...team.employees[1], active: false }],
    };
    const { unmount } = render(<TargetForm options={inactive} year={2026} />);
    expect(screen.queryByText(/Fictional Colleague/)).toBeNull();
    unmount();
    render(
      <TargetForm
        initial={draft([{ quarter: 1, employee_id: colleague, vertical_id: vertical, amount: "250.00" }])}
        options={inactive}
        year={2026}
      />,
    );
    expect(screen.getByRole("rowheader", { name: "Fictional Colleague (inactive)" })).toBeTruthy();
  });
});

describe("target drafts and locked approval", () => {
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
