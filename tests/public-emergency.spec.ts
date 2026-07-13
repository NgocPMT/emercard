import { expect, test, type Page } from "playwright/test";

const token = "demo-token_123";
const baseProfile = {
  display_name: "Demo User",
  birth_year: 1995,
  gender: "male",
  blood_type: "O+",
  critical_allergies: ["Penicillin"],
  important_conditions: ["Asthma"],
  critical_medications: ["Salbutamol inhaler"],
  emergency_note: "Fictional demonstration data only.",
  emergency_contacts: [{ name: "Demo Contact", relationship: "Sibling", phone: "0900000000" }],
  profile_updated_at: "2026-07-12T10:00:00Z",
};

async function serveTokenPage(page: Page) {
  await page.route(`**/e/${token}`, async (route) => {
    const response = await fetch("http://127.0.0.1:4321/e/");
    await route.fulfill({
      status: response.status,
      contentType: "text/html",
      body: await response.text(),
    });
  });
}

async function mockProfile(page: Page, status: number, body: unknown) {
  await page.route("**/api/v1/public/**", async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function mockTokenResponses(page: Page, responses: Record<string, { status: number; body: unknown }>) {
  await page.route("**/api/v1/public/**", async (route) => {
    const tokenPath = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const response = responses[tokenPath] ?? { status: 404, body: { error: { code: "public_profile.not_found", message: "safe" } } };
    await route.fulfill({
      status: response.status,
      contentType: "application/json",
      body: JSON.stringify(response.body),
    });
  });
}

test("renders the emergency profile and call action", async ({ page }) => {
  await serveTokenPage(page);
  await mockProfile(page, 200, { profile: baseProfile });

  await page.goto(`/e/${token}`);

  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Demo User/i })).toBeVisible();
  await expect(page.getByText("Nhóm máu")).toBeVisible();
  await expect(page.getByText("O+")).toBeVisible();
  await expect(page.getByRole("link", { name: "Gọi liên hệ" })).toHaveAttribute("href", "tel:0900000000");
  await expect(page.getByText(/2026/)).toBeVisible();
});

test("renders the not found state", async ({ page }) => {
  await serveTokenPage(page);
  await mockProfile(page, 404, { error: { code: "public_profile.not_found", message: "safe" } });

  await page.goto(`/e/${token}`);

  await expect(page.getByRole("alert")).toContainText("Không tìm thấy hồ sơ công khai");
});

test("renders the disabled and not ready states", async ({ page }) => {
  await serveTokenPage(page);
  await mockProfile(page, 410, { error: { code: "public_profile.disabled", message: "safe" } });
  await page.goto(`/e/${token}`);
  await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đã bị vô hiệu hóa");

  await page.unroute(`**/e/${token}`);
  await serveTokenPage(page);
  await page.unroute("**/api/v1/public/**");
  await mockProfile(page, 409, { error: { code: "public_profile.not_ready", message: "safe" } });
  await page.goto(`/e/${token}`);
  await expect(page.getByRole("alert")).toContainText("Hồ sơ công khai chưa sẵn sàng");
});

test("renders the service unavailable state and retries successfully", async ({ page }) => {
  await serveTokenPage(page);
  let calls = 0;
  await page.route("**/api/v1/public/**", async (route) => {
    calls += 1;
    if (calls === 1) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "public_profile.service_unavailable", message: "safe" } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ profile: baseProfile }),
    });
  });

  await page.goto(`/e/${token}`);

  await expect(page.getByRole("alert")).toContainText("Không thể tải hồ sơ công khai");
  await page.getByRole("button", { name: "Thử lại" }).click();
  await expect(page.getByRole("heading", { name: /Demo User/i })).toBeVisible();
});

test("renders two unique links and safe disabled or expired states", async ({ page }) => {
  const response = await fetch("http://127.0.0.1:4321/e/");
  const html = await response.text();
  for (const routePath of ["**/e/alpha", "**/e/beta", "**/e/disabled", "**/e/expired"]) {
    await page.route(routePath, async (route) => {
      await route.fulfill({
        status: response.status,
        contentType: "text/html",
        body: html,
      });
    });
  }

  await mockTokenResponses(page, {
    alpha: { status: 200, body: { profile: baseProfile } },
    beta: { status: 200, body: { profile: baseProfile } },
    disabled: { status: 410, body: { error: { code: "public_profile.disabled", message: "safe" } } },
    expired: { status: 409, body: { error: { code: "public_profile.expired", message: "safe" } } },
  });

  await page.goto(`/e/alpha`);
  await expect(page.getByRole("heading", { name: /Demo User/i })).toBeVisible();

  await page.goto(`/e/beta`);
  await expect(page.getByRole("heading", { name: /Demo User/i })).toBeVisible();

  await page.goto(`/e/disabled`);
  await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đã bị vô hiệu hóa");

  await page.goto(`/e/expired`);
  await expect(page.getByRole("alert")).toContainText("Liên kết hồ sơ đã hết hạn");
});
