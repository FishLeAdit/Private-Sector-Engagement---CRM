// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CorrectionForm } from "../../src/components/contributions/correction-form";
import { ContributionCorrections } from "../../src/components/contributions/corrections";
import type { Contribution } from "../../src/features/contributions/types";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("server-only", () => ({}));
const id = "f1000000-0000-4000-8000-000000000001";
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({ contribution: { id: "c" } }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function fill(amount: string, reason = "Fictional refund") {
  fireEvent.change(screen.getByLabelText("Amount to reverse (BDT) *"), { target: { value: amount } });
  fireEvent.change(screen.getByLabelText("Reason for the correction *"), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: "Review correction" }));
}
const body = (call = 0) => JSON.parse(fetcher.mock.calls[call][1].body);

describe("correction entry", () => {
  it("shows what is left, asks for confirmation and posts the positive amount to reverse", async () => {
    render(<CorrectionForm contributionId={id} currency="BDT" remaining="100.00" />);
    expect(screen.getByText("Up to BDT 100.00 can still be reversed.")).toBeTruthy();
    fill("40");
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Review correction" }).textContent).toContain("BDT -40.00");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and record correction" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).toBe(`/api/contributions/${id}/corrections`);
    expect(body()).toMatchObject({ amount: "40", reason: "Fictional refund" });
    expect(screen.getByRole("status").textContent).toBe("Correction of BDT 40.00 recorded.");
    expect(screen.getByRole("button", { name: "Review correction" })).toBeTruthy();
  });
  it("refuses more than is left and a missing reason before any request", () => {
    render(<CorrectionForm contributionId={id} currency="BDT" remaining="100.00" />);
    fill("100.01");
    expect(screen.getByRole("alert").textContent).toContain("At most BDT 100.00");
    fill("10", " ");
    expect(screen.getByRole("alert").textContent).toContain("Explain why");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("retries an uncertain write with the same request ID, and starts a new one after success", async () => {
    fetcher.mockRejectedValueOnce(new Error("Connection lost"));
    render(<CorrectionForm contributionId={id} currency="BDT" remaining="100.00" />);
    fill("10");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and record correction" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Back to edit" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry same correction" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    expect(body(1)).toEqual(body(0));
    await screen.findByRole("status");
    fill("5");
    fireEvent.click(screen.getByRole("button", { name: "Confirm and record correction" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(body(2).request_id).not.toBe(body(0).request_id);
  });
});

describe("corrections panel", () => {
  const receipt = { id, amount: 100, currency: "BDT" } as unknown as Contribution;
  const correction = {
    id: "f1000000-0000-4000-8000-000000000002",
    amount: -30,
    currency: "BDT",
    correction_reason: "Fictional duplicate",
    created_at: "2026-10-28T04:00:00Z",
    recorder: { display_name: "Fictional Manager" },
  };
  it("shows the net amount and offers the form to managers only", () => {
    render(<ContributionCorrections contribution={receipt} corrections={[correction]} manager />);
    expect(screen.getByRole("link", { name: "BDT -30.00" }).getAttribute("href")).toBe(
      `/contributions/${correction.id}`,
    );
    expect(screen.getByText("BDT 70.00")).toBeTruthy();
    expect(screen.getByText("Up to BDT 70.00 can still be reversed.")).toBeTruthy();
    cleanup();
    render(<ContributionCorrections contribution={receipt} corrections={[correction]} manager={false} />);
    expect(screen.queryByRole("button", { name: "Review correction" })).toBeNull();
  });
  it("closes the form once a receipt is fully reversed", () => {
    render(<ContributionCorrections contribution={receipt} corrections={[{ ...correction, amount: -100 }]} manager />);
    expect(screen.getByText("This contribution has been fully reversed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Review correction" })).toBeNull();
  });
});
