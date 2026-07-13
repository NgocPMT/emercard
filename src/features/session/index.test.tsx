import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/errors";
import { createPageQueryClient } from "../../api/query-client";
import { assignLocation, reloadPage, replaceLocation } from "../../lib/navigation";
import { PageApplicationRoot, PublicAuthGate, RouteAccessGate, SessionProvider, homeRoutes, useSession, validateReturnTo } from ".";

const getCurrentSessionMock = vi.fn();
const logoutMock = vi.fn();
const assignLocationMock = vi.mocked(assignLocation);
const replaceLocationMock = vi.mocked(replaceLocation);
const reloadPageMock = vi.mocked(reloadPage);

vi.mock("../../api/session", () => ({
  getCurrentSession: (...args: unknown[]) => getCurrentSessionMock(...args),
  logout: (...args: unknown[]) => logoutMock(...args),
  sessionKeys: { current: ["session", "current"] as const },
}));

vi.mock("../../lib/navigation", () => ({
  assignLocation: vi.fn(),
  replaceLocation: vi.fn(),
  reloadPage: vi.fn(),
}));

function SessionProbe() {
  const { session, status, isAuthenticated, isForbidden, isUnavailable } = useSession();
  return (
    <div>
      <p>Status: {status}</p>
      <p>Email: {session?.email ?? "none"}</p>
      <p>Authenticated: {String(isAuthenticated)}</p>
      <p>Forbidden: {String(isForbidden)}</p>
      <p>Unavailable: {String(isUnavailable)}</p>
    </div>
  );
}

function renderWithSession(children: React.ReactNode) {
  return render(
    <QueryClientProvider client={createPageQueryClient()}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>,
  );
}

const userSession = {
  id: "user-1",
  email: "user@example.com",
  role: "user" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const adminSession = {
  id: "admin-1",
  email: "admin@example.com",
  role: "admin" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mockMobileNavigation(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  getCurrentSessionMock.mockReset();
  logoutMock.mockReset();
  assignLocationMock.mockReset();
  replaceLocationMock.mockReset();
  reloadPageMock.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("session provider and gates", () => {
  it("exposes authenticated session state", async () => {
    getCurrentSessionMock.mockResolvedValueOnce(userSession);

    renderWithSession(<SessionProbe />);

    expect(await screen.findByText("Status: authenticated")).toBeInTheDocument();
    expect(screen.getByText("Email: user@example.com")).toBeInTheDocument();
    expect(screen.getByText("Authenticated: true")).toBeInTheDocument();
  });

  it("marks a 401 bootstrap as unauthenticated and redirects to a safe login path", async () => {
    getCurrentSessionMock.mockRejectedValueOnce(
      new ApiError({ status: 401, code: "auth.authentication_required", message: "Auth required", retryable: false }),
    );

    renderWithSession(
      <RouteAccessGate role="user" returnTo="https://evil.example/escape">
        <div>Protected</div>
      </RouteAccessGate>,
    );

    expect(await screen.findByText("Chuyển hướng đến đăng nhập")).toBeInTheDocument();
    await waitFor(() => expect(replaceLocationMock).toHaveBeenCalledWith("/login?returnTo=%2Fapp"));
  });

  it("renders auth children immediately while the session bootstrap is still pending", async () => {
    const pending = deferred<unknown>();
    getCurrentSessionMock.mockReturnValueOnce(pending.promise as Promise<unknown>);

    renderWithSession(
      <PublicAuthGate>
        <div>Login Form</div>
      </PublicAuthGate>,
    );

    expect(screen.getByText("Login Form")).toBeInTheDocument();
  });

  it("renders access denied for a 403 bootstrap failure", async () => {
    getCurrentSessionMock.mockRejectedValueOnce(
      new ApiError({ status: 403, code: "auth.forbidden", message: "Forbidden", retryable: false }),
    );

    renderWithSession(
      <RouteAccessGate role="user">
        <div>Protected</div>
      </RouteAccessGate>,
    );

    expect(await screen.findByRole("heading", { name: "Không có quyền truy cập" })).toBeInTheDocument();
  });

  it("renders a retryable service-unavailable state for bootstrap failures", async () => {
    getCurrentSessionMock.mockRejectedValue(
      new ApiError({ status: 503, code: "server_error", message: "Down", retryable: true }),
    );

    renderWithSession(
      <RouteAccessGate role="user">
        <div>Protected</div>
      </RouteAccessGate>,
    );

    expect(await screen.findByRole("heading", { name: "Không thể tải phiên" })).toBeInTheDocument();
  });

  it("keeps wrong-role sessions on an access-denied state", async () => {
    getCurrentSessionMock.mockResolvedValueOnce(adminSession);

    renderWithSession(
      <RouteAccessGate role="user">
        <div>Protected</div>
      </RouteAccessGate>,
    );

    expect(await screen.findByRole("heading", { name: "Không có quyền truy cập" })).toBeInTheDocument();
    expect(screen.getByText("Tài khoản hiện tại không phù hợp với khu vực này.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đi đến trang của tôi" })).toHaveAttribute("href", homeRoutes.admin);
  });

  it("signs out and clears caches before navigating to login", async () => {
    const user = userEvent.setup();
    const clearSpy = vi.spyOn(QueryClient.prototype, "clear");
    const logout = deferred<void>();
    getCurrentSessionMock.mockResolvedValueOnce(userSession);
    logoutMock.mockReturnValueOnce(logout.promise);

    render(
      <PageApplicationRoot role="user" brand="EmerCard" navigation={[]}>
        <div>Body</div>
      </PageApplicationRoot>,
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    const signOutButton = screen.getByRole("button", { name: "Đăng xuất" });
    await user.click(signOutButton);

    expect(signOutButton).toBeDisabled();
    logout.resolve();

    await waitFor(() => expect(logoutMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    expect(assignLocationMock).toHaveBeenCalledWith("/login");
  });

  it("moves sign out into the mobile navigation menu", async () => {
    const user = userEvent.setup();
    getCurrentSessionMock.mockResolvedValueOnce(userSession);
    mockMobileNavigation(true);

    render(
      <PageApplicationRoot role="user" brand="EmerCard" navigation={[{ href: "/app", label: "Tổng quan" }]}>
        <div>Body</div>
      </PageApplicationRoot>,
    );

    const navLabel = await screen.findByText("Điều hướng");
    await user.click(navLabel);

    const mobileSignOutButton = await screen.findByRole("button", { name: "Đăng xuất" });
    expect(mobileSignOutButton).toHaveClass("w-full");
    expect(mobileSignOutButton).toHaveClass("rounded-[var(--radius-control)]");
  });

  it("falls back to an honest logout notice when server confirmation fails", async () => {
    const user = userEvent.setup();
    const clearSpy = vi.spyOn(QueryClient.prototype, "clear");
    getCurrentSessionMock.mockResolvedValueOnce(userSession);
    logoutMock.mockRejectedValueOnce(new ApiError({ status: 0, code: "network_error", message: "Offline", retryable: true }));

    render(
      <PageApplicationRoot role="user" brand="EmerCard" navigation={[]}>
        <div>Body</div>
      </PageApplicationRoot>,
    );

    await screen.findByText("user@example.com");
    await user.click(screen.getByRole("button", { name: "Đăng xuất" }));

    await waitFor(() => expect(clearSpy).toHaveBeenCalled());
    await waitFor(() => expect(assignLocationMock).toHaveBeenCalledWith("/login?notice=logout-unconfirmed"));
  });
});
