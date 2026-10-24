import { describe, expect, it, vi } from "vitest";

vi.mock("./generated/client.gen", () => ({
  client: {
    setConfig: vi.fn(),
  },
}));

vi.mock("./generated/sdk.gen", () => ({
  currentUserApiV1MeGet: vi.fn(),
  loginApiV1AuthLoginPost: vi.fn(),
  logoutApiV1AuthLogoutPost: vi.fn(),
  registerApiV1AuthRegisterPost: vi.fn(),
}));

import { currentUserApiV1MeGet, loginApiV1AuthLoginPost, logoutApiV1AuthLogoutPost, registerApiV1AuthRegisterPost } from "./generated/sdk.gen";
import { getCurrentUser, login, logout, normalizeCurrentSession, registerAccount } from "./auth";
import { ApiError } from "./errors";

const user = {
  id: "user-1",
  email: "user@example.com",
  role: "user" as const,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("auth adapter", () => {
  it("normalizes current-user output into the safe session shape", () => {
    expect(normalizeCurrentSession(user)).toEqual(user);
  });

  it("returns the normalized user for register and login success", async () => {
    vi.mocked(registerApiV1AuthRegisterPost).mockResolvedValueOnce({ data: user, error: undefined } as never);
    vi.mocked(loginApiV1AuthLoginPost).mockResolvedValueOnce({ data: user, error: undefined } as never);

    await expect(registerAccount({ email: user.email, password: "password123" })).resolves.toEqual(user);
    await expect(login({ email: user.email, password: "password123" })).resolves.toEqual(user);
  });

  it("forwards phone number in registerAccount payload when provided", async () => {
    vi.mocked(registerApiV1AuthRegisterPost).mockResolvedValueOnce({ data: user, error: undefined } as never);

    await registerAccount({ email: user.email, phone: "0901234567", password: "password123" });

    expect(registerApiV1AuthRegisterPost).toHaveBeenCalledWith({
      body: {
        email: user.email,
        phone: "0901234567",
        password: "password123",
      },
      signal: undefined,
    });
  });

  it("maps registration errors to ApiError instances", async () => {
    vi.mocked(registerApiV1AuthRegisterPost).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(
        JSON.stringify({ error: { code: "auth.email_already_registered", message: "Already used", request_id: "req-1" } }),
        { status: 409, headers: { "content-type": "application/json" } },
      ),
    } as never);

    await expect(registerAccount({ email: user.email, password: "password123" })).rejects.toMatchObject({
      code: "auth.email_already_registered",
      status: 409,
    });
  });

  it("returns null for unauthenticated current-user responses", async () => {
    vi.mocked(currentUserApiV1MeGet).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(
        JSON.stringify({ error: { code: "auth.authentication_required", message: "Auth required", request_id: "req-2" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    } as never);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("surfaces forbidden current-user responses", async () => {
    vi.mocked(currentUserApiV1MeGet).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(
        JSON.stringify({ error: { code: "auth.forbidden", message: "Forbidden", request_id: "req-3" } }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    } as never);

    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });

  it("allows logout to complete on a 204 response", async () => {
    vi.mocked(logoutApiV1AuthLogoutPost).mockResolvedValueOnce({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 204 }),
    } as never);
    await expect(logout()).resolves.toBeUndefined();
  });
});
