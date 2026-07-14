import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateMyCard,
  createAdminUserLink,
  createBlankCard,
  getAdminCard,
  getMyCards,
  listAdminUserLinks,
  lookupAdminUserByEmail,
  provisionCardLink,
  reportMyCardLost,
} from "./cards";

const requestJsonMock = vi.fn();

vi.mock("./http-client", async () => {
  const actual = await vi.importActual<typeof import("./http-client")>("./http-client");
  return {
    ...actual,
    requestJson: (...args: unknown[]) => requestJsonMock(...args),
  };
});

beforeEach(() => {
  requestJsonMock.mockReset();
});

describe("cards api helpers", () => {
  it("parses the owner cards response", async () => {
    requestJsonMock.mockResolvedValue({ cards: [] });

    await expect(getMyCards()).resolves.toEqual({ cards: [] });
    expect(requestJsonMock).toHaveBeenCalledWith(expect.objectContaining({ path: "/me/cards" }));
  });

  it("parses provisioning responses and keeps URLs out of cached lists", async () => {
    requestJsonMock.mockResolvedValue({
      card: {
        id: "card-1",
        serial: "EMC-0000-0000-0000-0",
        status: "unassigned",
        is_current: false,
        encoding_state: "not_provisioned",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      provisioning: {
        public_token: "demo-token",
        public_url: "https://app.example/e/demo-token",
      },
    });

    await expect(provisionCardLink("card-1")).resolves.toMatchObject({
      provisioning: { public_url: "https://app.example/e/demo-token" },
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/admin/cards/card-1/provision-link", method: "POST" }),
    );
  });

  it("parses admin user lookup, link listings and one-time link provisioning", async () => {
    requestJsonMock.mockResolvedValueOnce({
      id: "user-1",
      email: "nurse@example.com",
      role: "user",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    await expect(lookupAdminUserByEmail("nurse@example.com")).resolves.toMatchObject({
      id: "user-1",
      email: "nurse@example.com",
    });
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/admin/users/lookup?email=nurse%40example.com" }),
    );

    requestJsonMock.mockResolvedValueOnce({
      items: [
        {
          id: "link-1",
          purpose: "card",
          status: "pending",
          label: "Card access",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          activated_at: null,
          disabled_at: null,
          revoked_at: null,
        },
      ],
    });
    await expect(listAdminUserLinks("user-1")).resolves.toMatchObject({
      items: [{ id: "link-1", purpose: "card" }],
    });

    requestJsonMock.mockResolvedValueOnce({
      link: {
        id: "link-2",
        purpose: "standalone",
        status: "active",
        label: "Xem trước",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      public_token: "standalone-token",
      public_url: "https://app.example/e/standalone-token",
    });
    await expect(createAdminUserLink("user-1", { purpose: "standalone" })).resolves.toMatchObject({
      public_url: "https://app.example/e/standalone-token",
    });

    requestJsonMock.mockResolvedValueOnce({
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      encoding_state: "verified",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      token_revision: 1,
    });
    await expect(getAdminCard("card-1")).resolves.toMatchObject({ id: "card-1", serial: "EMC-0000-0000-0000-0" });
  });

  it("calls the user card lifecycle endpoints", async () => {
    requestJsonMock.mockResolvedValue({
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      issued_at: "2026-01-01T00:00:00Z",
      activated_at: null,
      disabled_at: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
      can_activate: false,
      can_disable: true,
      can_report_lost: true,
      blocking_reason: null,
    });

    await activateMyCard("card-1");
    await reportMyCardLost("card-1");
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ path: "/me/cards/card-1/lost", method: "POST" }),
    );
  });
});
