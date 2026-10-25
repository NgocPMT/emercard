import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  activateMyCard,
  createAdminUserLink,
  getAdminCard,
  getMyCardAccessHistory,
  getMyCardAlerts,
  getMyCards,
  listAdminUserLinks,
  listAdminUsers,
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
  it("parses paginated card access history and encodes the cursor", async () => {
    requestJsonMock.mockResolvedValue({
      items: [{ id: "event-1", accessed_at: "2026-01-01T00:00:00Z" }],
      next_cursor: "opaque cursor",
    });
    await expect(getMyCardAccessHistory("card/1", "opaque cursor")).resolves.toEqual({
      items: [{ id: "event-1", accessed_at: "2026-01-01T00:00:00Z" }],
      next_cursor: "opaque cursor",
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/me/cards/card%2F1/access-history?cursor=opaque+cursor",
      }),
    );
  });

  it("parses card location alert incident history", async () => {
    requestJsonMock.mockResolvedValue({
      items: [
        {
          id: "alert-1",
          created_at: "2026-10-25T10:35:00Z",
          status: "sent",
          latitude: 9.738,
          longitude: 105.641,
          accuracy_meters: 13.5,
          nearby_place: "Cần Thơ, Việt Nam",
          map_url: "https://www.google.com/maps?q=9.738,105.641",
          recipients: [
            {
              recipient_name: "Người thân",
              recipient_phone: "036****038",
              recipient_relationship: "Gia đình",
              status: "sent",
              provider_id: "prov-1",
            },
          ],
        },
      ],
      next_cursor: null,
    });
    await expect(getMyCardAlerts("card-1")).resolves.toEqual({
      items: [
        {
          id: "alert-1",
          created_at: "2026-10-25T10:35:00Z",
          status: "sent",
          latitude: 9.738,
          longitude: 105.641,
          accuracy_meters: 13.5,
          nearby_place: "Cần Thơ, Việt Nam",
          map_url: "https://www.google.com/maps?q=9.738,105.641",
          recipients: [
            {
              recipient_name: "Người thân",
              recipient_phone: "036****038",
              recipient_relationship: "Gia đình",
              status: "sent",
              provider_id: "prov-1",
            },
          ],
        },
      ],
      next_cursor: null,
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/me/cards/card-1/alerts",
      }),
    );
  });

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

  it("parses the current admin user list", async () => {
    requestJsonMock.mockResolvedValue({
      items: [
        {
          id: "user-1",
          email: "nurse@example.com",
          role: "user",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
    await expect(listAdminUsers()).resolves.toMatchObject({
      items: [{ email: "nurse@example.com" }],
    });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/admin/users?limit=100" }),
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

  it("fetches admin inventory stats and batch provisions cards", async () => {
    requestJsonMock.mockResolvedValueOnce({
      total: 10,
      active: 5,
      available: 3,
      suspended: 1,
      lost: 1,
      void: 0,
    });
    const { getAdminInventoryStats, batchProvisionCards, getAdminCards } = await import("./cards");
    const stats = await getAdminInventoryStats();
    expect(stats.total).toBe(10);
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ path: "/admin/cards/stats" }),
    );

    requestJsonMock.mockResolvedValueOnce({
      batch_id: "BATCH-1",
      chip_type: "ntag215",
      quantity: 1,
      serial_start: "EMC-1",
      serial_end: "EMC-1",
      cards: [],
    });
    const batch = await batchProvisionCards({
      batch_id: "BATCH-1",
      chip_type: "ntag215",
      quantity: 1,
    });
    expect(batch.batch_id).toBe("BATCH-1");
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/admin/cards/batch",
        method: "POST",
      }),
    );

    requestJsonMock.mockResolvedValueOnce({ items: [], next_cursor: null });
    await getAdminCards({ search: "EMC-08", status: "active" });
    expect(requestJsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/admin/cards?search=EMC-08&status=active",
      }),
    );
  });
});

