import { describe, expect, it, vi } from "vitest";
import { extractEmergencyToken, getPublicEmergencyProfile } from "./public-emergency";

const okProfile = {
  profile: {
    display_name: "Emergency User",
    birth_year: 1995,
    gender: "male",
    blood_type: "O+",
    critical_allergies: ["Penicillin"],
    important_conditions: ["Asthma"],
    critical_medications: ["Salbutamol"],
    emergency_note: "Demo note",
    emergency_contacts: [{ name: "Sam Example", relationship: "Family", phone: "0900000000" }],
    profile_updated_at: "2026-01-01T00:00:00Z",
  },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("public emergency helper", () => {
  it("extracts only in-memory tokens from /e/* paths", () => {
    expect(extractEmergencyToken("/e/abc%20123")).toBe("abc 123");
    expect(extractEmergencyToken("/login")).toBeNull();
  });

  it("uses privacy-safe request options and returns the available state", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("omit");
      expect(init?.cache).toBe("no-store");
      expect(init?.referrerPolicy).toBe("no-referrer");
      return jsonResponse(okProfile);
    });

    vi.stubGlobal("fetch", fetchMock);
    await expect(getPublicEmergencyProfile("token-123")).resolves.toEqual({ kind: "available", profile: okProfile.profile });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    [404, "public_profile.not_found", { kind: "not_found" }],
    [410, "public_profile.disabled", { kind: "disabled" }],
    [409, "public_profile.not_ready", { kind: "not_ready" }],
    [503, "public_profile.service_unavailable", { kind: "service_unavailable", retryable: true }],
  ])("maps %s/%s to a safe state", async (status, code, expected) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ error: { code, message: "safe", request_id: "request-1" } }, status),
      ),
    );

    await expect(getPublicEmergencyProfile("token-123")).resolves.toMatchObject(expected as object);
  });
});
