import React from "react";
import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { sessionKeys } from "../../api/session";
import { AuthPageRoot } from ".";

const loginMock = vi.fn();
const registerMock = vi.fn();
const navigateMock = vi.fn();

vi.mock("../../api/auth", () => ({
  login: (...args: unknown[]) => loginMock(...args),
  registerAccount: (...args: unknown[]) => registerMock(...args),
}));

vi.mock("../../lib/navigation", () => ({
  assignLocation: (...args: unknown[]) => navigateMock(...args),
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
  navigateMock.mockReset();
  vi.restoreAllMocks();
});

function renderAuth(mode: "login" | "register", props: Partial<Parameters<typeof AuthPageRoot>[0]> = {}) {
  return render(<AuthPageRoot mode={mode} returnTo="/app" brand="EmerCard" {...props} />);
}

describe("auth page root", () => {
  it("registers successfully, updates session cache, and redirects directly to application", async () => {
    const user = userEvent.setup();
    const session = {
      id: "user-1",
      email: "new@example.com",
      role: "user" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    registerMock.mockResolvedValueOnce(session);

    renderAuth("register", { initialEmail: " new@example.com ", returnTo: "/app/profile" });

    expect(screen.getByDisplayValue("new@example.com")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    await waitFor(() => expect(registerMock).toHaveBeenCalledWith({ email: "new@example.com", password: "password123" }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/app/profile"));
  });

  it("registers successfully with phone number and redirects to default app path", async () => {
    const user = userEvent.setup();
    const session = {
      id: "user-phone",
      email: "user@example.com",
      role: "user" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    registerMock.mockResolvedValueOnce(session);

    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Số điện thoại/), "0901234567");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith({
        email: "user@example.com",
        phone: "0901234567",
        password: "password123",
      }),
    );
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith("/app"));
  });

  it("validates invalid phone number format", async () => {
    const user = userEvent.setup();
    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Số điện thoại/), "12345");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    expect(await screen.findByText("Số điện thoại không hợp lệ")).toBeInTheDocument();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("maps registration validation errors to the correct field messages", async () => {
    const user = userEvent.setup();
    registerMock.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: "validation_error",
        message: "Invalid payload",
        retryable: false,
        details: [{ path: "email", message: "Email không hợp lệ", type: "value_error" }],
      }),
    );

    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "bad-email");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    expect(await screen.findByText("Email không hợp lệ")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("maps duplicate registration to the email field", async () => {
    const user = userEvent.setup();
    registerMock.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "auth.email_already_registered",
        message: "Already used",
        retryable: false,
      }),
    );

    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    expect((await screen.findAllByText("Email này đã được sử dụng.")).length).toBeGreaterThan(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("maps duplicate phone registration to the phone field", async () => {
    const user = userEvent.setup();
    registerMock.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: "auth.phone_already_registered",
        message: "Already used",
        retryable: false,
      }),
    );

    renderAuth("register");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Số điện thoại/), "0901234567");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.type(screen.getByLabelText(/Xác nhận mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /Tạo tài khoản|Đăng Ký/i }));

    expect((await screen.findAllByText("Số điện thoại này đã được sử dụng.")).length).toBeGreaterThan(0);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("logs in successfully, updates the session cache, and redirects to the validated return path", async () => {
    const user = userEvent.setup();
    const session = {
      id: "user-2",
      email: "user@example.com",
      role: "user" as const,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const setQueryDataSpy = vi.spyOn(QueryClient.prototype, "setQueryData");
    loginMock.mockResolvedValueOnce(session);

    renderAuth("login", { returnTo: "/app/profile?tab=summary" });

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    await waitFor(() => expect(loginMock).toHaveBeenCalledWith({ email: "user@example.com", password: "password123" }));
    expect(setQueryDataSpy).toHaveBeenCalledWith(sessionKeys.current, session);
    expect(navigateMock).toHaveBeenCalledWith("/app/profile?tab=summary");
  });

  it("shows a generic error for invalid login credentials", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: "auth.invalid_credentials", message: "Invalid", retryable: false }),
    );

    renderAuth("login");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(await screen.findByText("Email hoặc mật khẩu không đúng.")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("falls back to a safe error message for unexpected login failures", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(new Error("boom"));

    renderAuth("login");

    await user.type(screen.getByLabelText(/Email/), "user@example.com");
    await user.type(screen.getByLabelText(/Mật khẩu/), "password123");
    await user.click(screen.getByRole("button", { name: /đăng nhập/i }));

    expect(await screen.findByText("Không thể kết nối tới máy chủ.")).toBeInTheDocument();
  });
});
