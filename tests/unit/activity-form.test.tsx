// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActivityForm } from "../../src/components/activities/activity-form";
import { ActivityStatus, DeleteActivityButton } from "../../src/components/activities/activity-controls";
import type { ActivityOptions } from "../../src/features/activities/types";
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
const userId = "00000000-0000-4000-8000-000000000002",
  meetingId = "30000000-0000-4000-8000-000000000001";
const options: ActivityOptions = {
  owners: [{ id: userId, display_name: "Fictional Employee", active: true }],
  contact: null,
  opportunity: null,
  meeting: null,
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({ activity: { id: "saved" }, deleted: true }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const show = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
  close = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterAll(() => {
  if (show) Object.defineProperty(HTMLDialogElement.prototype, "showModal", show);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (close) Object.defineProperty(HTMLDialogElement.prototype, "close", close);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
function form() {
  render(<ActivityForm options={options} userId={userId} manager={false} />);
}
const notes = () => screen.getByLabelText("Activity notes / context *");
describe("Activities form and status interactions", () => {
  it("requires person/organization context for independent entries", async () => {
    form();
    fireEvent.change(notes(), { target: { value: "Fictional context-free entry" } });
    fireEvent.click(screen.getByRole("button", { name: "Create activity" }));
    expect(
      await screen.findByText("Add a related person or organization, or link an existing CRM record."),
    ).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("requires descriptive notes without forcing contact, opportunity or meeting", async () => {
    form();
    fireEvent.click(screen.getByRole("button", { name: "Create activity" }));
    expect(await screen.findByText("Describe the activity.")).toBeTruthy();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("creates independent work with free person/organization context and UTC time", async () => {
    form();
    fireEvent.change(notes(), { target: { value: "Fictional school visit" } });
    fireEvent.change(screen.getByLabelText("Activity type *"), { target: { value: "visit" } });
    fireEvent.change(screen.getByLabelText("Related person"), { target: { value: "Fictional coordinator" } });
    fireEvent.change(screen.getByLabelText("Related organization"), { target: { value: "Fictional school" } });
    fireEvent.change(screen.getByLabelText("Relevant date/time (optional, Asia/Dhaka)"), {
      target: { value: "2026-10-28T00:15" },
    });
    fireEvent.change(screen.getByLabelText("Document URLs (optional, one per line)"), {
      target: { value: "https://drive.google.com/fictional" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create activity" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/activities/saved?saved=created"));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({
      activity_type: "visit",
      notes: "Fictional school visit",
      contact_id: "",
      opportunity_id: "",
      meeting_id: "",
      occurred_at: "2026-10-27T18:15:00.000Z",
      related_person_name: "Fictional coordinator",
      related_organization_name: "Fictional school",
      drive_urls: ["https://drive.google.com/fictional"],
    });
  });
  it("preserves drafts and shows field errors from a rejected save", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json(
        { error: "Linked record conflict.", fields: { contact_id: ["Choose a compatible contact."] } },
        { status: 422 },
      ),
    );
    form();
    fireEvent.change(notes(), { target: { value: "Preserve my fictional draft" } });
    fireEvent.change(screen.getByLabelText("Related organization"), { target: { value: "Fictional team" } });
    fireEvent.click(screen.getByRole("button", { name: "Create activity" }));
    expect(await screen.findByText("Choose a compatible contact.")).toBeTruthy();
    expect((notes() as HTMLTextAreaElement).value).toBe("Preserve my fictional draft");
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it("waits for meeting lookup, preserves notes and saves a meeting-only link", async () => {
    let complete!: (response: Response) => void;
    const meeting = {
      id: meetingId,
      title: "Fictional lookup meeting",
      contact_id: null,
      opportunity_id: null,
      contact: null,
      opportunity: null,
      status: "scheduled",
      scheduled_at: "2026-10-27T04:00:00Z",
    };
    fetcher.mockImplementation(async (url: string) =>
      url.startsWith("/api/meetings?")
        ? Response.json({ meetings: [meeting] })
        : url.startsWith("/api/activities/options?")
          ? new Promise<Response>(resolve => {
              complete = resolve;
            })
          : Response.json({ activity: { id: "saved" } }),
    );
    form();
    fireEvent.change(notes(), { target: { value: "Preserved meeting log" } });
    const picker = screen.getByRole("combobox", { name: "Meeting (optional)" });
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Fictional" } });
    fireEvent.click(await screen.findByRole("button", { name: meeting.title }));
    expect((screen.getByRole("button", { name: "Create activity" }) as HTMLButtonElement).disabled).toBe(true);
    complete(Response.json({ ...options, meeting }));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Create activity" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect((notes() as HTMLTextAreaElement).value).toBe("Preserved meeting log");
    fireEvent.click(screen.getByRole("button", { name: "Create activity" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls.at(-1)![1].body)).toMatchObject({
      meeting_id: meetingId,
      contact_id: "",
      opportunity_id: "",
    });
  });
  it("sends a status-only patch and refreshes", async () => {
    render(<ActivityStatus id="saved" status="open" />);
    fireEvent.change(screen.getByLabelText("Update activity status"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save status" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ status: "done" });
  });
});
function open() {
  render(<DeleteActivityButton id="saved" title="Fictional activity" />);
  fireEvent.click(screen.getByRole("button", { name: "Delete activity" }));
}
describe("activity deletion confirmation", () => {
  it("names the activity and cancels without a request", () => {
    open();
    expect(screen.getByText("Fictional activity")).toBeTruthy();
    expect(screen.getByText(/Audit history is retained/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("deletes only after confirmation and returns to the list", async () => {
    open();
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/activities?deleted=1"));
    expect(fetcher).toHaveBeenCalledWith("/api/activities/saved", { method: "DELETE", cache: "no-store" });
  });
  it("keeps a server failure visible and permits retry", async () => {
    fetcher.mockResolvedValueOnce(
      Response.json({ error: "Access has changed. Refresh and try again." }, { status: 403 }),
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Access has changed");
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("blocks duplicate deletion, cancel and Escape while pending", async () => {
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          complete = resolve;
        }),
    );
    open();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    const button = screen.getByRole("button", { name: "Deleting…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    complete(Response.json({ deleted: true }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  });
});
