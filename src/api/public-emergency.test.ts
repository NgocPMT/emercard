import { describe, expect, it, vi } from "vitest";
import {
  extractEmergencyToken,
  getPublicEmergencyProfile,
  sendPublicEmergencyLocationAlert,
} from "./public-emergency";

const okProfile = {
  profile: {
    profile_id: "profile-public-1",
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

  it("fails closed if a public response contains a private contact email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({
          profile: {
            ...okProfile.profile,
            emergency_contacts: [{ ...okProfile.profile.emergency_contacts[0], email: "private@example.com" }],
          },
        }),
      ),
    );

    await expect(getPublicEmergencyProfile("token-123")).resolves.toMatchObject({ kind: "service_unavailable" });
  });

  it("sends only the validated scanner payload with privacy-safe options", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.credentials).toBe("omit");
      expect(init?.cache).toBe("no-store");
      expect(init?.referrerPolicy).toBe("no-referrer");
      expect(JSON.parse(String(init?.body))).toEqual({
        latitude: 10.7769,
        longitude: 106.7009,
        accuracy_meters: 12,
        occurred_at: "2026-01-01T00:00:00.000Z",
      });
      return jsonResponse({ status: "sent" });
    });

    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendPublicEmergencyLocationAlert("token-123", {
        latitude: 10.7769,
        longitude: 106.7009,
        accuracy_meters: 12,
        occurred_at: "2026-01-01T00:00:00.000Z",
      }),
    ).resolves.toEqual({ kind: "sent" });
  });

  it.each([
    [200, { status: "unavailable" }, { kind: "unavailable" }],
    [200, { status: "cooldown" }, { kind: "cooldown" }],
    [429, { error: { code: "rate_limited", message: "safe" } }, { kind: "rate_limited" }],
    [503, { error: { code: "location_alert.service_unavailable", message: "safe" } }, { kind: "service_unavailable", retryable: true }],
  ])("maps location-alert response %s to a safe state", async (status, body, expected) => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(body, status)));
    await expect(
      sendPublicEmergencyLocationAlert("token-123", {
        latitude: 10,
        longitude: 20,
        accuracy_meters: 10,
        occurred_at: "2026-01-01T00:00:00.000Z",
      }),
    ).resolves.toMatchObject(expected as object);
  });

  it("rejects invalid coordinates before making a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      sendPublicEmergencyLocationAlert("token-123", {
        latitude: 91,
        longitude: 20,
        accuracy_meters: 10,
        occurred_at: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [404, "public_profile.not_found", { kind: "not_found" }],
    [410, "public_profile.disabled", { kind: "disabled" }],
    [409, "public_profile.pending", { kind: "pending" }],
    [409, "public_profile.revoked", { kind: "revoked" }],
    [409, "public_profile.expired", { kind: "expired" }],
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
