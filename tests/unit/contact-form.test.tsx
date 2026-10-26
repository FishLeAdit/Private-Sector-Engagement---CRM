// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ContactForm } from "../../src/components/contacts/contact-form";
import { CompanyPicker } from "../../src/components/contacts/company-picker";
import { emptyContact } from "../../src/features/contacts/schemas";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

const contactId = "10000000-0000-4000-8000-000000000099";
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockImplementation(async (url: string) => Response.json(url.includes("duplicates") ? { duplicates: [] } : url.includes("?") ? { contacts: [] } : { contact: { id: contactId } }));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("contact form interactions", () => {
  it("shows communication errors before attempting to save", async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/Contact name/), { target: { value: "Fictional Person" } });
    fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
    expect(await screen.findAllByText("Provide an email address or phone number.")).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("saves an individual without a company and opens the saved detail page", async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/Contact name/), { target: { value: "Fictional Person" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "fictional@example.invalid" } });
    fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/contacts/${contactId}?saved=created`));
    const save = fetcher.mock.calls.find(([url]) => url === "/api/contacts");
    expect(JSON.parse(save![1].body)).toMatchObject({ kind: "individual", company_id: "", email: "fictional@example.invalid" });
  });
  it("switches to company fields and accepts phone-only contact data", async () => {
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText("Contact type"), { target: { value: "company" } });
    expect(screen.queryByRole("combobox", { name: /Company \/ workplace/ })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Company name/), { target: { value: "Fictional Organization" } });
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+880 1700 008881" } });
    fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalled());
  });
  it("shows normalized duplicate matches while the user fills the form", async () => {
    fetcher.mockResolvedValue(Response.json({ duplicates: [{ id: contactId, name: "Fictional Existing Person", fields: ["email"] }] }));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "existing@example.invalid" } });
    expect(await screen.findByText("Possible duplicate contact")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Fictional Existing Person" }).getAttribute("href")).toBe(`/contacts/${contactId}`);
  });
  it("keeps entered values and displays server duplicate errors after a save race", async () => {
    fetcher.mockImplementation(async (url: string) => url.includes("duplicates") ? Response.json({ duplicates: [] }) : Response.json({ error: "A contact with that email or phone already exists.", fields: { email: ["Already used by another contact."] } }, { status: 409 }));
    render(<ContactForm />);
    fireEvent.change(screen.getByLabelText(/Contact name/), { target: { value: "Fictional Preserved Form" } });
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "race@example.invalid" } });
    fireEvent.change(screen.getByLabelText(/Relationship notes/), { target: { value: "Keep these notes after an error" } });
    fireEvent.click(screen.getByRole("button", { name: "Create contact" }));
    expect(await screen.findByText("Already used by another contact.")).toBeTruthy();
    expect((screen.getByLabelText(/Relationship notes/) as HTMLTextAreaElement).value).toBe("Keep these notes after an error");
    expect(navigation.push).not.toHaveBeenCalled();
  });
  it("keeps contact type immutable while editing and sends PATCH", async () => {
    render(<ContactForm contactId={contactId} initial={{ ...emptyContact, name: "Fictional Edit", phone: "+8801700008882" }} />);
    expect(screen.queryByRole("combobox", { name: "Contact type" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Relationship notes/), { target: { value: "Updated notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/contacts/${contactId}?saved=updated`));
    expect(fetcher.mock.calls.find(([url]) => url === `/api/contacts/${contactId}`)?.[1].method).toBe("PATCH");
  });
  it("looks up only internal companies and supports keyboard selection", async () => {
    const changed = vi.fn();
    fetcher.mockResolvedValue(Response.json({ contacts: [{ id: contactId, name: "Fictional Internal Company" }] }));
    render(<CompanyPicker value="" onChange={changed} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Internal" } });
    await screen.findByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(changed).toHaveBeenCalledWith(contactId);
    expect(String(fetcher.mock.calls[0][0])).toContain("/api/contacts?kind=company");
  });
});
