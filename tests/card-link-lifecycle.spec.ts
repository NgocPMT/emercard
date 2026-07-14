import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser, type Page } from "playwright/test";
import type { CurrentSession, PublicEmergencyProfile } from "../src/api/types";

type DemoCard = {
  id: string;
  serial: string;
  token: string;
};

const backendBaseUrl = process.env.EMERCARD_E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
const adminEmail = process.env.EMERCARD_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.EMERCARD_ADMIN_PASSWORD ?? "password-123";
let backendReady = false;

const profilePayload: Omit<PublicEmergencyProfile, "profile_updated_at"> = {
  display_name: "EmerCard Demo User",
  birth_year: 1996,
  gender: "female",
  blood_type: "O+",
  critical_allergies: ["Penicillin"],
  important_conditions: ["Asthma"],
  critical_medications: ["Salbutamol inhaler"],
  emergency_note: "Demo data only.",
  emergency_contacts: [{ name: "Demo Contact", relationship: "Sibling", phone: "0900000000" }],
};

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  backendReady = await fetch(new URL("/health", backendBaseUrl))
    .then((response) => response.ok)
    .catch(() => false);
});

test.beforeEach(() => {
  test.skip(!backendReady, `FastAPI backend is unavailable at ${backendBaseUrl}`);
});

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@example.com`;
}

function cardPanel(page: Page, serial: string) {
  return page.getByRole("heading", { name: `Thẻ ${serial}` }).locator("xpath=ancestor::section[1]");
}

async function readJson<T>(response: { json(): Promise<unknown> }) {
  return (await response.json()) as T;
}

async function registerUser(request: APIRequestContext, email: string, password: string) {
  const response = await request.post("/api/v1/auth/register", {
    data: { email, password },
  });
  expect(response.status()).toBe(201);
  return await readJson<CurrentSession>(response);
}

async function loginUser(request: APIRequestContext, email: string, password: string) {
  const response = await request.post("/api/v1/auth/login", {
    data: { email, password },
  });
  expect(response.ok()).toBeTruthy();
  const session = await readJson<CurrentSession>(response);
  expect(session.role).toBe("user");
  return session;
}

async function browserJsonRequest(
  page: Page,
  path: string,
  method: string,
  body?: unknown,
) {
  return await page.evaluate(
    async ({ path, method, body }) => {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { ok: response.ok, status: response.status, text: await response.text() };
    },
    { path, method, body },
  );
}

async function seedProfile(page: Page) {
  const response = await browserJsonRequest(page, "/api/v1/me/profile", "PUT", profilePayload);
  expect(response.ok, `profile update failed: ${response.status} ${response.text}`).toBeTruthy();
}

async function createAuthenticatedPage(browser: Browser, request: APIRequestContext, email: string, password: string) {
  await loginUser(request, email, password);
  const storageState = await request.storageState();
  const context = await browser.newContext({ storageState, baseURL: "http://127.0.0.1:4321" });
  const page = await context.newPage();
  return { context, page };
}

async function loginAdmin(request: APIRequestContext) {
  const response = await request.post("/api/v1/auth/login", {
    data: { email: adminEmail, password: adminPassword },
  });
  if (response.status() === 401) {
    return false;
  }
  expect(response.ok()).toBeTruthy();
  const sessionResponse = await request.get("/api/v1/me");
  expect(sessionResponse.ok()).toBeTruthy();
  const session = await readJson<CurrentSession>(sessionResponse);
  expect(session.role).toBe("admin");
  return true;
}

async function createIssuedCard(request: APIRequestContext, userId: string): Promise<DemoCard> {
  const createdResponse = await request.post("/api/v1/admin/cards", {
    headers: { "Idempotency-Key": randomUUID() },
  });
  expect(createdResponse.ok(), `create card failed: ${createdResponse.status()} ${await createdResponse.text()}`).toBeTruthy();
  const created = await readJson<{ id: string; serial: string }>(createdResponse);

  const provisionResponse = await request.post(`/api/v1/admin/cards/${created.id}/provision-link`);
  expect(provisionResponse.ok()).toBeTruthy();
  const provisioned = await readJson<{
    card: { id: string; serial: string };
    provisioning: { public_token: string; public_url: string };
  }>(provisionResponse);

  const encodingResponse = await request.post(`/api/v1/admin/cards/${created.id}/confirm-encoding`, {
    data: { public_url: provisioned.provisioning.public_url },
  });
  expect(
    encodingResponse.ok(),
    `confirm encoding failed: ${encodingResponse.status()} ${await encodingResponse.text()}`,
  ).toBeTruthy();

  const assignResponse = await request.post(`/api/v1/admin/cards/${created.id}/assign`, {
    data: { user_id: userId },
  });
  expect(assignResponse.ok()).toBeTruthy();

  const userLinkResponse = await request.post(`/api/v1/admin/users/${userId}/links`, {
    data: { purpose: "card", label: "Card access" },
  });
  expect(userLinkResponse.ok(), `create user link failed: ${userLinkResponse.status()} ${await userLinkResponse.text()}`).toBeTruthy();
  const userLink = await readJson<{
    link: { id: string };
    public_token: string;
    public_url: string;
  }>(userLinkResponse);

  const attachResponse = await request.post(`/api/v1/admin/cards/${created.id}/link/attach`, {
    data: { public_access_link_id: userLink.link.id },
  });
  expect(
    attachResponse.ok(),
    `attach link failed: ${attachResponse.status()} ${await attachResponse.text()}`,
  ).toBeTruthy();

  const issueResponse = await request.post(`/api/v1/admin/cards/${created.id}/issue`);
  expect(issueResponse.ok()).toBeTruthy();

  return {
    id: created.id,
    serial: created.serial,
    token: userLink.public_token,
  };
}

async function prepareUser(browser: Browser, request: APIRequestContext) {
  const email = uniqueEmail("card-lifecycle");
  const password = "password123";
  const user = await registerUser(request, email, password);
  const { context, page } = await createAuthenticatedPage(browser, request, email, password);
  await page.goto("/app/cards");
  await expect(page.getByRole("heading", { name: "Thẻ của tôi" })).toBeVisible();
  await seedProfile(page);
  return { user, email, password, context, page };
}

async function acceptConfirm(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept());
}

test("keeps one card URL usable across pending -> active -> disabled -> active and preserves sibling availability", async ({ browser, request }) => {
  const { user, context, page } = await prepareUser(browser, request);
  try {
    const adminReady = await loginAdmin(request);
    test.skip(!adminReady, `Seed the admin account with ${adminEmail} / ${adminPassword} before running live card lifecycle e2e.`);

    const cardA = await createIssuedCard(request, user.id);
    const cardB = await createIssuedCard(request, user.id);

    await page.reload();
    const panelA = cardPanel(page, cardA.serial);
    const panelB = cardPanel(page, cardB.serial);

    await expect(panelA).toContainText("Liên kết: pending");
    await expect(panelB).toContainText("Liên kết: pending");

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đang chờ kích hoạt");
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto("/app/cards");
    await acceptConfirm(page);
    await panelA.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(panelA).toContainText("Liên kết: active");
    await expect(panelA.getByRole("button", { name: "Kích hoạt" })).toBeDisabled();
    await expect(panelA.getByRole("button", { name: "Vô hiệu hóa" })).toBeEnabled();

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("heading", { name: "EmerCard Demo User" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto("/app/cards");
    await acceptConfirm(page);
    await panelB.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(panelB).toContainText("Liên kết: active");
    await expect(panelB.getByRole("button", { name: "Vô hiệu hóa" })).toBeEnabled();

    await acceptConfirm(page);
    await panelA.getByRole("button", { name: "Vô hiệu hóa" }).click();
    await expect(panelA).toContainText("Liên kết: disabled");
    await expect(panelA.getByRole("button", { name: "Kích hoạt" })).toBeEnabled();
    await expect(panelB).toContainText("Liên kết: active");

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đã bị vô hiệu hóa");
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto("/app/cards");
    await acceptConfirm(page);
    await panelA.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(panelA).toContainText("Liên kết: active");

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("heading", { name: "EmerCard Demo User" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto(`/e/${cardB.token}`);
    await expect(page.getByRole("heading", { name: "EmerCard Demo User" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${cardB.token}$`));
  } finally {
    await context.close();
  }
});

test("rejects lost cards on the neutral public view and keeps sibling cards available", async ({ browser, request }) => {
  const { user, context, page } = await prepareUser(browser, request);
  try {
    const adminReady = await loginAdmin(request);
    test.skip(!adminReady, `Seed the admin account with ${adminEmail} / ${adminPassword} before running live card lifecycle e2e.`);

    const cardA = await createIssuedCard(request, user.id);
    const cardB = await createIssuedCard(request, user.id);

    await page.reload();
    const panelA = cardPanel(page, cardA.serial);
    const panelB = cardPanel(page, cardB.serial);

    await acceptConfirm(page);
    await panelA.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(panelA).toContainText("Liên kết: active");

    await acceptConfirm(page);
    await panelB.getByRole("button", { name: "Kích hoạt" }).click();
    await expect(panelB).toContainText("Liên kết: active");

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("heading", { name: "EmerCard Demo User" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto("/app/cards");
    await acceptConfirm(page);
    await panelA.getByRole("button", { name: "Báo mất" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: `Thẻ ${cardA.serial}` })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: `Thẻ ${cardB.serial}` })).toBeVisible();

    const activationAfterLost = await browserJsonRequest(page, `/api/v1/me/cards/${cardA.id}/activate`, "POST");
    expect(activationAfterLost.ok).toBeFalsy();

    await page.goto(`/e/${cardA.token}`);
    await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đã bị thu hồi");
    await expect(page).toHaveURL(new RegExp(`/e/${cardA.token}$`));

    await page.goto(`/e/${cardB.token}`);
    await expect(page.getByRole("heading", { name: "EmerCard Demo User" })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/e/${cardB.token}$`));
  } finally {
    await context.close();
  }
});
