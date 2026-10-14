import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentUser, login, logout, normalizeCurrentSession, registerAccount } from "./auth";
import { ApiError } from "./errors";
import { clearTokens, getAccessToken, setTokens } from "./token-storage";

const rawUserSnake = {
  id: "user-1",
  email: "user@example.com",
  role: "user" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const rawUserCamel = {
  id: "user-2",
  email: "camel@example.com",
  role: "admin" as const,
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

const mockTokens = {
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
};

describe("auth adapter", () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it("normalizes current-user output from snake_case and camelCase", () => {
    expect(normalizeCurrentSession(rawUserSnake)).toEqual({
      id: "user-1",
      email: "user@example.com",
      role: "user",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(normalizeCurrentSession(rawUserCamel)).toEqual({
      id: "user-2",
      email: "camel@example.com",
      role: "admin",
      created_at: "2026-02-01T00:00:00.000Z",
      updated_at: "2026-02-01T00:00:00.000Z",
    });
  });

  it("returns normalized user and stores tokens on login success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: rawUserCamel, tokens: mockTokens }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await login({ email: "camel@example.com", password: "password123" });

    expect(session.email).toBe("camel@example.com");
    expect(session.role).toBe("admin");
    expect(getAccessToken()).toBe("mock-access-token");

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit | undefined)?.body as string);
    expect(body).toEqual({
      identifier: "camel@example.com",
      password: "password123",
    });
  });

  it("returns normalized user and stores tokens on registerAccount success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ user: rawUserSnake, tokens: mockTokens }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await registerAccount({ email: "user@example.com", password: "password123" });

    expect(session.email).toBe("user@example.com");
    expect(session.role).toBe("user");
    expect(getAccessToken()).toBe("mock-access-token");

    const call = fetchMock.mock.calls[0];
    const body = JSON.parse((call?.[1] as RequestInit | undefined)?.body as string);
    expect(body.email).toBe("user@example.com");
    expect(body.password).toBe("password123");
    expect(body.username).toBeDefined();
  });

  it("returns null immediately when no token is in storage for getCurrentUser", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const session = await getCurrentUser();

    expect(session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches and returns current user when token exists in storage", async () => {
    setTokens(mockTokens);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(rawUserSnake), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await getCurrentUser();

    expect(session).toEqual(rawUserSnake);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]?.toString()).toContain("/auth/me");
  });

  it("clears tokens and returns null on 401 for getCurrentUser", async () => {
    setTokens({ accessToken: "bad-token", refreshToken: "bad-refresh" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Unauthorized", code: "unauthorized" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const session = await getCurrentUser();

    expect(session).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("clears tokens on logout", async () => {
    setTokens(mockTokens);
    expect(getAccessToken()).toBe("mock-access-token");

    await logout();
    expect(getAccessToken()).toBeNull();
  });
});
