// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { OpportunityForm } from "../../src/components/opportunities/opportunity-form";
import { StageMove } from "../../src/components/opportunities/stage-move";
import { emptyOpportunity } from "../../src/features/opportunities/schemas";
import type { OpportunityOptions, Party } from "../../src/features/opportunities/types";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const userId = "00000000-0000-4000-8000-000000000002", contactId = "10000000-0000-4000-8000-000000000004";
const stage = "70000000-0000-4000-8000-000000000001", won = "70000000-0000-4000-8000-000000000006", category = "80000000-0000-4000-8000-000000000001";
const options = { stages: [{ id: stage, name: "Fictional open", active: true }, { id: won, name: "Fictional won", active: true }], categories: [{ id: category, name: "Fictional category", active: true }], owners: [{ id: userId, display_name: "Fictional employee", active: true }] } as OpportunityOptions;
const party: Party = { id: contactId, name: "Fictional person", kind: "individual", email: "person@example.invalid", phone: null, website: null };
const initial = { ...emptyOpportunity, deal_name: "Fictional draft", contact_id: contactId, owner_id: userId, stage_id: stage, contribution_category_id: category, expected_amount: "150.25" };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  fetcher = vi.fn().mockImplementation(async (url: string) => Response.json(url.includes("duplicates") ? { duplicates: [] } : url.startsWith("/api/contacts?") ? { contacts: [] } : url === "/api/contacts" ? { contact: party } : { opportunity: { id: "saved-deal" } }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("opportunity form interactions", () => {
  it("requires an expected financial value before sending a deal", async () => {
    render(<OpportunityForm initial={{ ...initial, expected_amount: "0" }} contacts={{ contact_id: party }} options={options} userId={userId} manager={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Create deal" })); expect(await screen.findByText("Enter an expected financial value greater than zero.")).toBeTruthy();
    expect(fetcher.mock.calls.some(([url]) => url === "/api/opportunities")).toBe(false);
  });
  it("creates a contact inline, keeps the draft and selects the saved contact without navigation", async () => {
    render(<OpportunityForm options={options} userId={userId} manager={false} />);
    fireEvent.change(screen.getByLabelText("Deal name *"), { target: { value: "Fictional preserved deal" } });
    fireEvent.change(screen.getByLabelText("Budgeted fund (expected value) *"), { target: { value: "120.50" } });
    fireEvent.change(screen.getByLabelText("Stage *"), { target: { value: stage } }); fireEvent.change(screen.getByLabelText("Contribution category *"), { target: { value: category } });
    fireEvent.change(screen.getByLabelText("Notes (optional)"), { target: { value: "Keep my draft notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
    const modal = within(screen.getByRole("dialog"));
    fireEvent.change(modal.getByLabelText(/Contact name/), { target: { value: party.name } }); fireEvent.change(modal.getByLabelText("Email address"), { target: { value: party.email } });
    fireEvent.click(modal.getByRole("button", { name: "Create contact" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect((screen.getByRole("combobox", { name: "Individual / company" }) as HTMLInputElement).value).toBe(party.name);
    expect((screen.getByLabelText("Notes (optional)") as HTMLTextAreaElement).value).toBe("Keep my draft notes"); expect(navigation.push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Create deal" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/opportunities/saved-deal?saved=created"));
    const saved = JSON.parse(fetcher.mock.calls.find(([url]) => url === "/api/opportunities")![1].body);
    expect(saved).toMatchObject({ deal_name: "Fictional preserved deal", expected_amount: "120.50", contact_id: contactId, notes: "Keep my draft notes" });
    expect(document.querySelector("form form")).toBeNull();
  });
  it("retains form values on server rejection and accepts blank reference lines", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "Linked record conflict.", fields: {} }, { status: 422 }));
    render(<OpportunityForm initial={initial} contacts={{ contact_id: party }} options={options} userId={userId} manager={false} />);
    fireEvent.change(screen.getByLabelText(/Document reference URLs/), { target: { value: "\nhttps://drive.google.com/file/d/demo/view\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Create deal" })); expect(await screen.findByText("Linked record conflict.")).toBeTruthy();
    expect((screen.getByLabelText("Deal name *") as HTMLInputElement).value).toBe(initial.deal_name);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).drive_urls).toEqual(["https://drive.google.com/file/d/demo/view"]); expect(navigation.push).not.toHaveBeenCalled();
  });
  it("shows company contact people and enforces manual in-kind valuation", async () => {
    render(<OpportunityForm initial={{ ...initial, contribution_type: "valued_in_kind" }} contacts={{ contact_id: { ...party, kind: "company", website: "https://example.invalid" } }} options={options} userId={userId} manager />);
    expect(screen.getByRole("combobox", { name: "Primary contact" })).toBeTruthy(); expect(screen.getByRole("combobox", { name: "Secondary contact (optional)" })).toBeTruthy(); expect(screen.getByText(/https:\/\/example.invalid/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create deal" })); expect(await screen.findByText("Describe the agreed manual valuation and its source.")).toBeTruthy();
  });
  it("uses explicit stage-only updates and displays rejected stage moves", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "Your access changed." }, { status: 403 }));
    render(<StageMove id="deal-id" stageId={stage} stages={options.stages} />);
    fireEvent.change(screen.getByLabelText("Move to stage"), { target: { value: won } }); fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(await screen.findByText("Your access changed.")).toBeTruthy(); expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ stage_id: won }); expect(navigation.refresh).not.toHaveBeenCalled();
  });
});
