import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "playwright/test";

const backendBaseUrl = process.env.EMERCARD_E2E_BACKEND_URL ?? "http://127.0.0.1:8000";
let backendReady = false;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  backendReady = await fetch(new URL("/health", backendBaseUrl))
    .then((response) => response.ok)
    .catch(() => false);
});

test.beforeEach(() => {
  test.skip(!backendReady, `FastAPI backend is unavailable at ${backendBaseUrl}`);
});

function authEmail() {
  return `auth-${randomUUID()}@example.com`;
}

async function waitForAuthHydration(page: Page) {
  await page.waitForFunction(() => document.body.dataset.authHydrated === "true");
}


test("registers, logs in, restores the session, and logs out", async ({ page }) => {
  const email = authEmail();
  const password = "password123";

  await page.goto("/register");
  await waitForAuthHydration(page);
  await expect(page.getByRole("heading", { name: /Tạo tài khoản EmerCard/i })).toBeVisible();
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByLabel(/Xác nhận mật khẩu/).fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();

  await expect(page).toHaveURL(/\/login\?notice=registration-success&email=/);
  await waitForAuthHydration(page);
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/);
  await expect(page.getByText(email)).toBeVisible();
  expect(await page.evaluate(() => document.cookie)).not.toContain("emercard_session");

  await page.reload();
  await expect(page.getByText(email)).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login(?:\/)?$/);
  await expect(page.getByRole("heading", { name: /Đăng nhập|Truy cập tài khoản EmerCard/i })).toBeVisible();

  await page.goto("/app");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await expect(page.getByRole("heading", { name: /Đăng nhập|Truy cập tài khoản EmerCard/i })).toBeVisible();
});

test("rejects duplicate registration and invalid login with safe messages", async ({ page }) => {
  const email = authEmail();
  const password = "password123";

  await page.goto("/register");
  await waitForAuthHydration(page);
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByLabel(/Xác nhận mật khẩu/).fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page).toHaveURL(/\/login\?notice=registration-success&email=/);

  const duplicate = await page.request.post("/api/v1/auth/register", {
    data: { email, password },
  });
  expect(duplicate.status()).toBe(409);
  expect((await duplicate.json()).error.code).toBe("auth.email_already_registered");

  await page.goto("/login");
  await waitForAuthHydration(page);
  await page.getByLabel(/Email/).fill("missing@example.com");
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page.getByText("Email hoặc mật khẩu không đúng.")).toBeVisible();
  await expect(page.url()).toContain("/login");
});

test("denies normal users from admin routes, keeps the cookie hidden, and redirects auth pages", async ({ page }) => {
  const email = authEmail();
  const password = "password123";

  await page.goto("/register");
  await waitForAuthHydration(page);
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByLabel(/Xác nhận mật khẩu/).fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page).toHaveURL(/\/login\?notice=registration-success&email=/);
  await waitForAuthHydration(page);
  await page.getByLabel(/Email/).fill(email);
  await page.getByLabel(/Mật khẩu/).first().fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/app(?:\/)?$/);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Không có quyền truy cập" })).toBeVisible();
  await expect(page.getByText("Tài khoản hiện tại không phù hợp với khu vực này.")).toBeVisible();

  expect(await page.evaluate(() => document.cookie)).not.toContain("emercard_session");

  await page.goto("/login");
  await expect(page).toHaveURL(/\/app(?:\/)?$/);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/app(?:\/)?$/);
});

test("shows bootstrap failures as service unavailable and leaves /e/* public", async ({ page }) => {
  await page.route("**/api/v1/me", (route) => route.abort());

  await page.goto("/login");
  await waitForAuthHydration(page);
  await expect(page.getByRole("heading", { name: /Không thể kiểm tra phiên/i })).toBeVisible();

  await page.unroute("**/api/v1/me");
  await page.goto("/e/");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Thông tin y tế khẩn cấp/i })).toBeVisible();
});
