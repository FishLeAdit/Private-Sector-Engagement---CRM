// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MeetingForm } from "../../src/components/meetings/meeting-form";
import { FollowUpForm } from "../../src/components/meetings/follow-up-form";
import { MeetingStatus } from "../../src/components/meetings/meeting-status";
import { emptyMeeting } from "../../src/features/meetings/schemas";
import type { MeetingContact, MeetingOpportunity, MeetingOptions } from "../../src/features/meetings/types";
const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
const userId = "00000000-0000-4000-8000-000000000002", contactId = "10000000-0000-4000-8000-000000000004", opportunityId = "20000000-0000-4000-8000-000000000001";
const contact: MeetingContact = { id: contactId, name: "Fictional Meeting Person", kind: "individual", email: "meeting@example.invalid", phone: "+1 202 555 0120", website: null, designation: "Demo coordinator", company_id: null, company: null };
const options: MeetingOptions = { owners: [{ id: userId, display_name: "Fictional Employee", active: true }], contact, opportunity: null };
const opportunity: MeetingOpportunity = { id: opportunityId, deal_name: "Fictional Meeting Deal", contact_id: contactId, primary_contact_id: null, secondary_contact_id: null, contact, primary_contact: null, secondary_contact: null };
const initial = { ...emptyMeeting, title: "Fictional discussion", contact_id: contactId, owner_id: userId, scheduled_at: "2026-10-27T04:30:00.000Z" };
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.clearAllMocks(); fetcher = vi.fn().mockResolvedValue(Response.json({ meeting: { id: "saved-meeting" } })); vi.stubGlobal("fetch", fetcher); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe("meeting form interactions", () => {
  it("requires a link and time before sending a meeting", async () => {
    render(<MeetingForm options={{ ...options, contact: null }} userId={userId} manager={false} />);
    fireEvent.change(screen.getByLabelText("Meeting title *"), { target: { value: "No link/time" } }); fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));
    expect(await screen.findAllByText("Link a contact or an opportunity.")).toHaveLength(2); expect(fetcher).not.toHaveBeenCalled();
  });
  it("displays designation/communication and stores Dhaka input as UTC", async () => {
    render(<MeetingForm initial={initial} options={options} userId={userId} manager={false} />);
    expect(screen.getByText("Demo coordinator")).toBeTruthy(); expect(screen.getAllByText(/meeting@example.invalid/).length).toBeGreaterThan(0);
    expect((screen.getByLabelText("Meeting date and time (Asia/Dhaka) *") as HTMLInputElement).value).toBe("2026-10-27T10:30");
    fireEvent.change(screen.getByLabelText("Meeting date and time (Asia/Dhaka) *"), { target: { value: "2026-10-28T00:15" } }); fireEvent.click(screen.getByRole("button", { name: "Create meeting" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/meetings/saved-meeting?saved=created"));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ scheduled_at: "2026-10-27T18:15:00.000Z", contact_id: contactId, opportunity_id: "" });
  });
  it("saves an opportunity-only meeting using derived contact details", async () => {
    render(<MeetingForm initial={{ ...initial, contact_id: "", opportunity_id: opportunityId }} options={{ ...options, contact: null, opportunity }} userId={userId} manager={false} />);
    expect(screen.getByText(/Derived from the opportunity/)).toBeTruthy(); expect(screen.getByText("Demo coordinator")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create meeting" })); await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ contact_id: "", opportunity_id: opportunityId });
  });
  it("preserves an edit draft after a linked-record server conflict", async () => {
    fetcher.mockResolvedValue(Response.json({ error: "Existing activities use this contact.", fields: { contact_id: ["Choose a compatible contact."] } }, { status: 422 }));
    render(<MeetingForm meetingId="meeting-id" initial={initial} options={options} userId={userId} manager={false} />);
    fireEvent.change(screen.getByLabelText("Description (optional)"), { target: { value: "Keep my agenda" } }); fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Choose a compatible contact.")).toBeTruthy(); expect((screen.getByLabelText("Description (optional)") as HTMLTextAreaElement).value).toBe("Keep my agenda");
    expect(fetcher.mock.calls[0][1].method).toBe("PATCH"); expect(navigation.push).not.toHaveBeenCalled();
  });
  it("loads only internal opportunities and keeps draft fields during selection", async () => {
    fetcher.mockImplementation(async (url: string) => Response.json(url.startsWith("/api/opportunities?") ? { opportunities: [opportunity] } : { ...options, opportunity }));
    render(<MeetingForm options={{ ...options, contact: null }} userId={userId} manager={false} />);
    fireEvent.change(screen.getByLabelText("Meeting title *"), { target: { value: "Preserved lookup draft" } });
    const picker = screen.getByRole("combobox", { name: "Opportunity (optional)" }); fireEvent.focus(picker); fireEvent.change(picker, { target: { value: "Fictional" } });
    await screen.findByRole("option", { name: opportunity.deal_name }); fireEvent.keyDown(picker, { key: "ArrowDown" }); fireEvent.keyDown(picker, { key: "Enter" });
    expect(await screen.findByText(/Derived from the opportunity/)).toBeTruthy(); expect((screen.getByLabelText("Meeting title *") as HTMLInputElement).value).toBe("Preserved lookup draft");
    expect(fetcher.mock.calls.some(([url]) => String(url).startsWith("/api/meetings/options?opportunity_id="))).toBe(true);
  });
  it("sends a status-only completion update", async () => {
    render(<MeetingStatus id="meeting-id" status="scheduled" />); fireEvent.change(screen.getByLabelText("Update meeting status"), { target: { value: "done" } }); fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled()); expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ status: "done" });
  });
  it("waits for the selected opportunity's details before allowing submission", async () => {
    let complete!: (response: Response) => void;
    fetcher.mockImplementation(async (url: string) => url.startsWith("/api/opportunities?") ? Response.json({ opportunities: [opportunity] }) : url.startsWith("/api/meetings/options?") ? new Promise<Response>(resolve => { complete = resolve; }) : Response.json({ meeting: { id: "saved-meeting" } }));
    render(<MeetingForm initial={initial} options={options} userId={userId} manager={false} />);
    const picker = screen.getByRole("combobox", { name: "Opportunity (optional)" }); fireEvent.focus(picker); fireEvent.change(picker, { target: { value: "Fictional" } });
    fireEvent.click(await screen.findByRole("button", { name: opportunity.deal_name }));
    const submit = screen.getByRole("button", { name: "Create meeting" }); expect((submit as HTMLButtonElement).disabled).toBe(true); fireEvent.click(submit);
    expect(fetcher.mock.calls.some(([url]) => url === "/api/meetings")).toBe(false);
    complete(Response.json({ ...options, opportunity })); await waitFor(() => expect((submit as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(submit);
    await waitFor(() => expect(navigation.push).toHaveBeenCalled()); expect(JSON.parse(fetcher.mock.calls.find(([url]) => url === "/api/meetings")![1].body).opportunity_id).toBe(opportunityId);
  });
  it("creates a follow-up task with the relevant UTC instant and keeps failures editable", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "Try again." }, { status: 503 })).mockResolvedValueOnce(Response.json({ activity: { id: "task-id" } }, { status: 201 }));
    render(<FollowUpForm meetingId="meeting-id" userId={userId} owners={options.owners} manager={false} />);
    fireEvent.change(screen.getByLabelText("Follow-up task *"), { target: { value: "Send the proposal" } }); fireEvent.change(screen.getByLabelText("Relevant date/time (optional, Asia/Dhaka)"), { target: { value: "2026-10-28T09:00" } }); fireEvent.click(screen.getByRole("button", { name: "Create follow-up task" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Try again"); expect((screen.getByLabelText("Follow-up task *") as HTMLTextAreaElement).value).toBe("Send the proposal");
    fireEvent.click(screen.getByRole("button", { name: "Create follow-up task" })); expect(await screen.findByText("Follow-up task created.")).toBeTruthy();
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ notes: "Send the proposal", owner_id: userId, occurred_at: "2026-10-28T03:00:00.000Z" }); expect((screen.getByLabelText("Follow-up task *") as HTMLTextAreaElement).value).toBe("");
  });
});
