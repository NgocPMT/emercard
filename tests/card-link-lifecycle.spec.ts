import { expect, test, type Page, type Route } from "playwright/test";
import type { CurrentSession, PublicEmergencyProfile } from "../src/api/types";

type LinkLifecycleState = "pending" | "active" | "disabled";

type CardFixture = {
  id: string;
  serial: string;
  token: string;
  profile: PublicEmergencyProfile;
  linkLabel: string;
  linkStatus: LinkLifecycleState;
  activatedAt: string | null;
  disabledAt: string | null;
  canActivate: boolean;
  canDisable: boolean;
  blockingReason: string | null;
};

const NOW = "2026-07-14T09:00:00Z";
const SESSION: CurrentSession = {
  id: "user-1",
  email: "owner@example.com",
  role: "user",
  created_at: NOW,
  updated_at: NOW,
};

const baseProfile: PublicEmergencyProfile = {
  display_name: "EmerCard Demo User",
  birth_year: 1996,
  gender: "female",
  blood_type: "O+",
  critical_allergies: ["Penicillin"],
  important_conditions: ["Asthma"],
  critical_medications: ["Salbutamol inhaler"],
  emergency_note: "Demo data only.",
  emergency_contacts: [
    { name: "Demo Contact", relationship: "Sibling", phone: "0900000000" },
  ],
  profile_updated_at: NOW,
};

function cardFixture(
  overrides: Partial<CardFixture> &
    Pick<CardFixture, "id" | "serial" | "token" | "profile">,
): CardFixture {
  return {
    linkLabel: "Card access",
    linkStatus: "pending",
    activatedAt: null,
    disabledAt: null,
    canActivate: true,
    canDisable: false,
    blockingReason: "Liên kết công khai đang chờ kích hoạt",
    ...overrides,
  };
}

function toUserCard(card: CardFixture) {
  return {
    id: card.id,
    serial: card.serial,
    status: "active",
    is_current: true,
    issued_at: NOW,
    activated_at: card.activatedAt,
    disabled_at: card.disabledAt,
    created_at: NOW,
    updated_at: NOW,
    can_activate: card.canActivate,
    can_disable: card.canDisable,
    can_report_lost: true,
    blocking_reason: card.blockingReason,
    link_status: card.linkStatus,
    link_purpose: "card",
    link_label: card.linkLabel,
  };
}

function jsonResponse(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function createState() {
  const cards = new Map<string, CardFixture>([
    [
      "card-a",
      cardFixture({
        id: "card-a",
        serial: "EMC-A-0001",
        token: "token-a",
        profile: {
          ...baseProfile,
          display_name: "Demo User A",
        },
      }),
    ],
    [
      "card-b",
      cardFixture({
        id: "card-b",
        serial: "EMC-B-0002",
        token: "token-b",
        linkStatus: "active",
        activatedAt: NOW,
        canActivate: false,
        canDisable: true,
        blockingReason: null,
        profile: {
          ...baseProfile,
          display_name: "Demo User B",
          blood_type: "A+",
        },
        linkLabel: "Sibling card",
      }),
    ],
  ]);

  return {
    cards,
    listCards() {
      return [...cards.values()].map(toUserCard);
    },
    getCardById(cardId: string) {
      return cards.get(cardId) ?? null;
    },
    getCardByToken(token: string) {
      return [...cards.values()].find((card) => card.token === token) ?? null;
    },
  };
}

async function installMockApi(
  page: Page,
  state: ReturnType<typeof createState>,
) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;
    const method = request.method();

    if (method === "GET" && pathname === "/api/v1/me") {
      await jsonResponse(route, SESSION);
      return;
    }

    if (method === "GET" && pathname === "/api/v1/me/cards") {
      await jsonResponse(route, { cards: state.listCards() });
      return;
    }

    const cardMutation = pathname.match(
      /^\/api\/v1\/me\/cards\/([^/]+)\/(activate|disable)$/,
    );
    if (method === "POST" && cardMutation) {
      const cardId = cardMutation[1];
      const action = cardMutation[2];
      if (!cardId || !action) {
        throw new Error(
          `Unexpected card mutation request: ${method} ${pathname}`,
        );
      }
      const card = state.getCardById(cardId);
      if (!card) {
        await jsonResponse(
          route,
          { error: { code: "card.not_found", message: "safe" } },
          404,
        );
        return;
      }

      if (action === "activate") {
        card.linkStatus = "active";
        card.activatedAt ??= NOW;
        card.disabledAt = null;
        card.canActivate = false;
        card.canDisable = true;
        card.blockingReason = null;
      } else {
        card.linkStatus = "disabled";
        card.disabledAt = NOW;
        card.canActivate = true;
        card.canDisable = false;
        card.blockingReason = "Liên kết công khai đã tạm dừng";
      }

      await jsonResponse(route, toUserCard(card));
      return;
    }

    if (method === "GET" && pathname.startsWith("/api/v1/public/")) {
      const token = decodeURIComponent(pathname.split("/").at(-1) ?? "");
      const card = state.getCardByToken(token);
      if (!card) {
        await jsonResponse(
          route,
          { error: { code: "public_profile.not_found", message: "safe" } },
          404,
        );
        return;
      }
      if (card.linkStatus === "pending") {
        await jsonResponse(
          route,
          { error: { code: "public_profile.pending", message: "safe" } },
          409,
        );
        return;
      }
      if (card.linkStatus === "disabled") {
        await jsonResponse(
          route,
          { error: { code: "public_profile.disabled", message: "safe" } },
          410,
        );
        return;
      }
      await jsonResponse(route, { profile: card.profile });
      return;
    }

    throw new Error(`Unexpected API request: ${method} ${pathname}`);
  });
}

function cardPanel(page: Page, serial: string) {
  return page
    .getByRole("heading", { name: `Thẻ ${serial}` })
    .locator("xpath=ancestor::section[1]");
}

async function acceptConfirm(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
}

test("keeps the same public token URL usable across activate, disable, and reactivate", async ({
  page,
}) => {
  const state = createState();
  await installMockApi(page, state);

  const cardA = cardPanel(page, "EMC-A-0001");
  const cardB = cardPanel(page, "EMC-B-0002");

  await page.goto("/app/cards");
  await expect(
    page.getByRole("heading", { name: "Thẻ của tôi" }),
  ).toBeVisible();
  await expect(cardA).toContainText("Liên kết: pending");
  await expect(cardA).toContainText(
    "Lý do chặn: Liên kết công khai đang chờ kích hoạt",
  );
  await expect(cardB).toContainText("Liên kết: active");

  await page.goto("/e/token-a");
  await expect(page.getByRole("alert")).toContainText(
    "Liên kết hồ sơ đang chờ kích hoạt",
  );
  await expect(page).toHaveURL(/\/e\/token-a$/);

  await page.goto("/app/cards");
  await acceptConfirm(page);
  await cardA.getByRole("button", { name: "Kích hoạt" }).click();
  await expect(cardA).toContainText("Liên kết: active");
  await expect(cardA).not.toContainText("Lý do chặn");
  await expect(cardB).toContainText("Liên kết: active");

  await page.goto("/e/token-a");
  await expect(
    page.getByRole("heading", { name: "Demo User A" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/e\/token-a$/);

  await page.goto("/app/cards");
  await acceptConfirm(page);
  await cardA.getByRole("button", { name: "Vô hiệu hóa" }).click();
  await expect(cardA).toContainText("Liên kết: disabled");
  await expect(cardA).toContainText(
    "Lý do chặn: Liên kết công khai đã tạm dừng",
  );
  await expect(cardB).toContainText("Liên kết: active");

  await page.goto("/e/token-a");
  await expect(page.getByRole("alert")).toContainText(
    "Liên kết hồ sơ đã bị vô hiệu hóa",
  );
  await expect(page).toHaveURL(/\/e\/token-a$/);

  await page.goto("/e/token-b");
  await expect(
    page.getByRole("heading", { name: "Demo User B" }),
  ).toBeVisible();
  await expect(page.getByText("Demo User B")).toBeVisible();
  await expect(page).toHaveURL(/\/e\/token-b$/);

  await page.goto("/app/cards");
  await acceptConfirm(page);
  await cardA.getByRole("button", { name: "Kích hoạt" }).click();
  await expect(cardA).toContainText("Liên kết: active");
  await expect(cardB).toContainText("Liên kết: active");

  await page.goto("/e/token-a");
  await expect(
    page.getByRole("heading", { name: "Demo User A" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/e\/token-a$/);
});
