import { beforeEach, describe, expect, it, vi } from "vitest";
import { requestJson, tryRefreshToken } from "./http-client";
import { clearTokens, getAccessToken, setTokens } from "./token-storage";

describe("http-client", () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it("attaches Authorization header when accessToken exists", async () => {
    setTokens({ accessToken: "test-token-123", refreshToken: "test-refresh-123" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJson<{ ok: boolean }>({ path: "/test" });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    const requestHeaders = (call?.[1] as RequestInit | undefined)?.headers as Headers;
    expect(requestHeaders.get("Authorization")).toBe("Bearer test-token-123");
  });

  it("does not overwrite explicitly passed Authorization header", async () => {
    setTokens({ accessToken: "stored-token", refreshToken: "stored-refresh" });

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestJson({
      path: "/test",
      headers: { Authorization: "Bearer custom-token" },
    });

    const customCall = fetchMock.mock.calls[0];
    const requestHeaders = (customCall?.[1] as RequestInit | undefined)?.headers as Headers;
    expect(requestHeaders.get("Authorization")).toBe("Bearer custom-token");
  });

  it("refreshes token on 401 and retries original request", async () => {
    setTokens({ accessToken: "expired-token", refreshToken: "valid-refresh" });

    const fetchMock = vi
      .fn()
      // Initial request -> 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Unauthorized", code: "unauthorized" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      // Refresh request -> returns new tokens
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      // Retry request -> 200 OK
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: "success" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await requestJson<{ data: string }>({ path: "/me/profile" });

    expect(result).toEqual({ data: "success" });
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const call0 = fetchMock.mock.calls[0];
    const call1 = fetchMock.mock.calls[1];
    const call2 = fetchMock.mock.calls[2];

    // Initial call
    expect(((call0?.[1] as RequestInit | undefined)?.headers as Headers).get("Authorization")).toBe("Bearer expired-token");
    // Refresh call
    expect(call1?.[0]?.toString()).toContain("/auth/refresh");
    // Retry call
    expect(((call2?.[1] as RequestInit | undefined)?.headers as Headers).get("Authorization")).toBe("Bearer new-access-token");
    expect(getAccessToken()).toBe("new-access-token");
  });

  it("clears tokens and throws error when token refresh fails", async () => {
    setTokens({ accessToken: "expired-token", refreshToken: "invalid-refresh" });

    const fetchMock = vi
      .fn()
      // Initial request -> 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Unauthorized", code: "unauthorized" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      // Refresh request -> 401
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: "Invalid refresh token", code: "invalid_token" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(requestJson({ path: "/me/profile" })).rejects.toThrow();
    expect(getAccessToken()).toBeNull();
  });
});
