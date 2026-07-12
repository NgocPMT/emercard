import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { AuthPageRoot } from ".";

const loginMock = vi.fn();
const registerMock = vi.fn();

vi.mock("../../api/auth", () => ({
  login: (...args: unknown[]) => loginMock(...args),
  registerAccount: (...args: unknown[]) => registerMock(...args),
}));

vi.mock("../../api/session", () => ({
  sessionKeys: { current: ["session", "current"] as const },
}));

vi.mock("../session", () => ({
  PageErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PublicAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  validateReturnTo: (returnTo: string | null | undefined) => returnTo ?? "/app",
}));

afterEach(() => {
  loginMock.mockReset();
  registerMock.mockReset();
  vi.unstubAllGlobals();
});

function renderAuth(mode: "login" | "register", props: Partial<Parameters<typeof AuthPageRoot>[0]> = {}) {
  return render(<AuthPageRoot mode={mode} returnTo="/app" brand="EmerCard" {...props} />);
}

describe("auth page root", () => {
  it("prefills email and submits registration", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign, replace: vi.fn(), href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "", hash: "" });
    let resolveRegistration: ((value: unknown) => void) | undefined;
    registerMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      }),
    );

    renderAuth("register", { initialEmail: "new@example.com" });

    expect(screen.getByDisplayValue("new@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    await waitFor(() => expect(registerMock).toHaveBeenCalledWith({ email: "new@example.com", password: "password123" }));
    expect(screen.getByRole("button", { name: "Đang tạo tài khoản..." })).toBeDisabled();
    resolveRegistration?.({
      id: "user-1",
      email: "new@example.com",
      role: "user",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("shows a generic error for invalid login credentials", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: "auth.invalid_credentials", message: "Invalid", retryable: false }),
    );

    renderAuth("login");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: "Đăng nhập" }));

    expect(await screen.findByText("Email hoặc mật khẩu không đúng.")).toBeInTheDocument();
  });

  it("marks the register submit button busy while registration is pending", async () => {
    const user = userEvent.setup();
    const assign = vi.fn();
    vi.stubGlobal("location", { assign, replace: vi.fn(), href: "http://localhost/", origin: "http://localhost", pathname: "/", search: "", hash: "" });
    let resolveRegistration: ((value: unknown) => void) | undefined;
    registerMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveRegistration = resolve;
      }),
    );

    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "pending@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: "Tạo tài khoản" }));

    expect(screen.getByRole("button", { name: "Đang tạo tài khoản..." })).toBeDisabled();
    resolveRegistration?.({
      id: "user-2",
      email: "pending@example.com",
      role: "user",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });
  });
});
