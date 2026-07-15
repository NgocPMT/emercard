import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateMyCard,
  createAdminUserLink,
  getAdminCard,
  getMyCards,
  listAdminUserLinks,
  lookupAdminUserByEmail,
  reportMyCardLost,
  revokeMyCard,
} from "./cards";

const requestJsonMock = vi.fn();
vi.mock("./http-client", async () => ({
  ...(await vi.importActual<typeof import("./http-client")>("./http-client")),
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}));
beforeEach(() => requestJsonMock.mockReset());

const userCard = {
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
  can_revoke: true,
  can_report_lost: true,
  blocking_reason: null,
};

describe("cards api helpers", () => {
  it("parses the owner cards response", async () => {
    requestJsonMock.mockResolvedValue({ cards: [] });
    await expect(getMyCards()).resolves.toEqual({ cards: [] });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/me/cards" }),
    );
  });

  it("creates profile-owned pending links and returns the one-time URL", async () => {
    requestJsonMock.mockResolvedValue({
      link: {
        id: "link-1",
        purpose: "card",
        status: "pending",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      public_token: "demo-token",
      public_url: "https://app.example/e/demo-token",
    });
    await expect(
      createAdminUserLink("user-1", { label: "Thẻ chính" }),
    ).resolves.toMatchObject({
      public_url: "https://app.example/e/demo-token",
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/admin/users/user-1/links",
        method: "POST",
        body: { purpose: "card", label: "Thẻ chính" },
      }),
    );
  });

  it("parses admin user lookup, safe link listings and card details", async () => {
    requestJsonMock.mockResolvedValueOnce({
      id: "user-1",
      email: "nurse@example.com",
      role: "user",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    await expect(
      lookupAdminUserByEmail("nurse@example.com"),
    ).resolves.toMatchObject({ id: "user-1", email: "nurse@example.com" });
    requestJsonMock.mockResolvedValueOnce({
      items: [
        {
          id: "link-1",
          purpose: "card",
          status: "pending",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    await expect(listAdminUserLinks("user-1")).resolves.toMatchObject({
      items: [{ id: "link-1", purpose: "card" }],
    });
    requestJsonMock.mockResolvedValueOnce({
      id: "card-1",
      serial: "EMC-0000-0000-0000-0",
      status: "active",
      is_current: true,
      encoding_state: "verified",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    await expect(getAdminCard("card-1")).resolves.toMatchObject({
      id: "card-1",
    });
  });

  it("calls user card lifecycle endpoints without storing token material", async () => {
    requestJsonMock.mockResolvedValue(userCard);
    await activateMyCard("card-1");
    await revokeMyCard("card-1");
    await reportMyCardLost("card-1");
    expect(requestJsonMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        path: "/me/cards/card-1/lost",
        method: "POST",
      }),
    );
    expect(
      requestJsonMock.mock.calls.some(([request]) =>
        JSON.stringify(request).includes("token"),
      ),
    ).toBe(false);
  });
});
