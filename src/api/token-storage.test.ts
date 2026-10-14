import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "./token-storage";

describe("token-storage", () => {
  beforeEach(() => {
    clearTokens();
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stores and retrieves tokens in localStorage", () => {
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();

    setTokens({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    expect(getAccessToken()).toBe("mock-access-token");
    expect(getRefreshToken()).toBe("mock-refresh-token");
    expect(window.localStorage.getItem("emercard_access_token")).toBe("mock-access-token");
    expect(window.localStorage.getItem("emercard_refresh_token")).toBe("mock-refresh-token");

    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(window.localStorage.getItem("emercard_access_token")).toBeNull();
    expect(window.localStorage.getItem("emercard_refresh_token")).toBeNull();
  });

  it("falls back to in-memory storage when localStorage throws errors", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    setTokens({
      accessToken: "mem-access-token",
      refreshToken: "mem-refresh-token",
    });

    expect(getAccessToken()).toBe("mem-access-token");
    expect(getRefreshToken()).toBe("mem-refresh-token");

    clearTokens();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });
});
