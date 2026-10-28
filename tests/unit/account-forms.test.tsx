// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AccountEditor, PasswordForm } from "../../src/components/settings/account-editor";
import { CreateAccountForm } from "../../src/components/settings/create-account-form";
import type { Account } from "../../src/features/accounts/types";
const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

const account: Account = {
  id: "00000000-0000-4000-8000-0000000000a2",
  email: "staff@fictional.example",
  display_name: "Fictional Staff",
  department: "PSE",
  role: "pse_member",
  active: true,
  last_sign_in_at: null,
};
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  fetcher = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const body = () => JSON.parse(fetcher.mock.calls[0][1].body);

describe("account forms", () => {
  it("creates an account with an initial password and the chosen role", async () => {
    render(<CreateAccountForm disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "New account" }));
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "new@fictional.example" } });
    fireEvent.change(screen.getByLabelText("Initial password *"), { target: { value: "fictional-pass" } });
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "New Manager" } });
    fireEvent.change(screen.getByLabelText("Role *"), { target: { value: "pse_manager" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(navigation.refresh).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).toBe("/api/accounts");
    expect(body()).toEqual({
      email: "new@fictional.example",
      password: "fictional-pass",
      display_name: "New Manager",
      department: "PSE",
      role: "pse_manager",
    });
    expect(screen.getByRole("status").textContent).toBe("Account created for New Manager.");
  });
  it("restricts another account by clearing Active", async () => {
    render(<AccountEditor account={account} self={false} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Active/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][1].method).toBe("PATCH");
    expect(body()).toEqual({ display_name: "Fictional Staff", department: "PSE", role: "pse_member", active: false });
  });
  it("lets a superadmin rename themselves but never change their own access", async () => {
    render(<AccountEditor account={{ ...account, role: "admin" }} self />);
    expect((screen.getByRole("combobox", { name: "Role *" }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Active/ }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Name *"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save account" }));
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(body()).toEqual({ display_name: "Renamed", department: "PSE", role: "admin", active: true });
  });
  it("sets a password and shows the server's message on failure", async () => {
    fetcher.mockResolvedValueOnce(Response.json({ error: "Account not found." }, { status: 404 }));
    render(<PasswordForm id={account.id} disabled={false} />);
    fireEvent.change(screen.getByLabelText("New password *"), { target: { value: "fictional-pass-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Account not found.");
    expect(fetcher.mock.calls[0][0]).toBe(`/api/accounts/${account.id}/password`);
  });
});
