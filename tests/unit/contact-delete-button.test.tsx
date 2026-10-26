// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteContactButton } from "../../src/components/contacts/delete-contact-button";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const id = "10000000-0000-4000-8000-000000000099";
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  // jsdom does not implement native modal focus/top-layer behavior.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value(this: HTMLDialogElement) { this.open = false; } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow); else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose); else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({ deleted: true, id }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("contact deletion confirmation", () => {
  it("names the contact and lets the user cancel without a request", () => {
    render(<DeleteContactButton contactId={id} name="Fictional Cancelled Contact" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete contact" }));
    const dialog = screen.getByRole("dialog", { name: "Delete contact?" });
    expect(screen.getByText("Fictional Cancelled Contact")).toBeTruthy();
    expect(screen.getByText(/Audit history is retained/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("deletes only after explicit confirmation and returns to the contact list", async () => {
    render(<DeleteContactButton contactId={id} name="Fictional Deleted Contact" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete contact" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/contacts?deleted=1"));
    expect(fetcher).toHaveBeenCalledWith(`/api/contacts/${id}`, { method: "DELETE", cache: "no-store" });
    expect(navigation.refresh).toHaveBeenCalled();
  });
  it("keeps the dialog open and displays linked-record errors", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "This contact is linked to other records." }, { status: 409 }));
    render(<DeleteContactButton contactId={id} name="Fictional Linked Contact" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect((await screen.findByRole("alert")).textContent).toContain("linked");
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("prevents duplicate submissions while deletion is pending", async () => {
    let complete!: (value: Response) => void;
    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { complete = resolve; }));
    render(<DeleteContactButton contactId={id} name="Fictional Pending Contact" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete contact" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect((screen.getByRole("button", { name: "Deleting…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    complete(Response.json({ deleted: true, id }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  });
});
