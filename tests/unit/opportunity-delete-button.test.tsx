// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteOpportunityButton } from "../../src/components/opportunities/delete-opportunity-button";
const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const id = "20000000-0000-4000-8000-000000000099";
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal"),
  originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
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
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({ deleted: true, id }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe("opportunity deletion confirmation", () => {
  it("names the opportunity, explains retained history and cancels without a request", () => {
    render(<DeleteOpportunityButton opportunityId={id} name="Fictional cancelled deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete opportunity" }));
    const dialog = screen.getByRole("dialog", { name: "Delete opportunity?" });
    expect(screen.getByText("Fictional cancelled deal")).toBeTruthy();
    expect(screen.getByText(/Audit history is retained/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("deletes only after confirmation and returns to the opportunity list", async () => {
    render(<DeleteOpportunityButton opportunityId={id} name="Fictional deleted deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete opportunity" }));
    expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith("/opportunities?deleted=1"));
    expect(fetcher).toHaveBeenCalledWith(`/api/opportunities/${id}`, { method: "DELETE", cache: "no-store" });
    expect(navigation.refresh).toHaveBeenCalled();
  });
  it("retains the dialog and error when linked records block deletion", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "Linked contributions prevent deletion." }, { status: 409 }));
    render(<DeleteOpportunityButton opportunityId={id} name="Fictional linked deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete opportunity" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Linked contributions");
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(navigation.replace).not.toHaveBeenCalled();
  });
  it("disables confirmation/cancellation and prevents Escape dismissal while pending", async () => {
    let complete!: (response: Response) => void;
    fetcher.mockImplementationOnce(
      () =>
        new Promise<Response>(resolve => {
          complete = resolve;
        }),
    );
    render(<DeleteOpportunityButton opportunityId={id} name="Fictional pending deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete opportunity" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    const button = screen.getByRole("button", { name: "Deleting…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(cancel.defaultPrevented).toBe(true);
    complete(Response.json({ deleted: true, id }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  });
  it("shows a network failure and allows retry without losing the dialog", async () => {
    fetcher.mockRejectedValueOnce(new Error("Network failure"));
    render(<DeleteOpportunityButton opportunityId={id} name="Fictional retry deal" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete opportunity" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Check your connection");
    expect(navigation.replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalled());
  });
});
