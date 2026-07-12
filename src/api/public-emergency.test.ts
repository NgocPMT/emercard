import { describe, expect, it, vi } from "vitest";
import { extractEmergencyToken, getPublicEmergencyProfile } from "./public-emergency";

describe("public emergency helper", () => {
  it("extracts only in-memory tokens from /e/* paths", () => {
    expect(extractEmergencyToken("/e/abc%20123")).toBe("abc 123");
    expect(extractEmergencyToken("/login")).toBeNull();
  });

  it("uses privacy-safe request options", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("omit");
      expect(init?.cache).toBe("no-store");
      expect(init?.referrerPolicy).toBe("no-referrer");
      return new Response(
        JSON.stringify({ profile: { display_name: "Emergency User" } }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    await expect(getPublicEmergencyProfile("token-123")).resolves.toEqual({ display_name: "Emergency User" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
