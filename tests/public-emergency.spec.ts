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

test("requests scanner location only after explicit consent and sends a safe alert", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          const state = window as Window & { __geoCalls?: number };
          state.__geoCalls = (state.__geoCalls ?? 0) + 1;
          success({
            coords: {
              latitude: 10.7769,
              longitude: 106.7009,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });
  await serveTokenPage(page);
  let alertCalls = 0;
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "POST") {
      alertCalls += 1;
      expect(JSON.parse(route.request().postData() ?? "{}")).toMatchObject({
        latitude: 10.7769,
        longitude: 106.7009,
        accuracy_meters: 12,
      });
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "sent" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: baseProfile }) });
  });

  await page.goto(`/e/${token}`);
  expect(await page.evaluate(() => (window as Window & { __geoCalls?: number }).__geoCalls ?? 0)).toBe(0);
  const alertButton = page.getByRole("button", { name: "Gửi cảnh báo vị trí" });
  await expect(alertButton).toBeVisible();
  await alertButton.click();
  await expect(page.getByText("Đã gửi cảnh báo vị trí đến các liên hệ khẩn cấp.")).toBeVisible();
  expect(alertCalls).toBe(1);
  expect(await page.evaluate(() => (window as Window & { __geoCalls?: number }).__geoCalls ?? 0)).toBe(1);
});

test("shows an actionable location permission error", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(_success: PositionCallback, error: PositionErrorCallback) {
          error({ code: 1, message: "denied" } as GeolocationPositionError);
        },
      },
    });
  });
  await serveTokenPage(page);
  let postCount = 0;
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "cooldown" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: baseProfile }) });
  });

  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Gửi cảnh báo vị trí" }).click();
  await expect(page.getByText(/đã từ chối quyền vị trí/i)).toBeVisible();
  expect(postCount).toBe(0);
});

test("renders the backend cooldown state", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: { latitude: 10, longitude: 20, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });
  await serveTokenPage(page);
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "cooldown" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: baseProfile }) });
  });

  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Gửi cảnh báo vị trí" }).click();
  await expect(page.getByText(/vừa được xử lý/i)).toBeVisible();
});

test("prevents duplicate clicks while locating and shows unavailable safely", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          const state = window as Window & { __geoCalls?: number; __resolveLocation?: PositionCallback };
          state.__geoCalls = (state.__geoCalls ?? 0) + 1;
          state.__resolveLocation = success;
        },
      },
    });
  });
  await serveTokenPage(page);
  let postCount = 0;
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "POST") {
      postCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "unavailable" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: baseProfile }) });
  });

  await page.goto(`/e/${token}`);
  const alertButton = page.locator("#location-alert-button");
  await alertButton.click();
  await expect(alertButton).toBeDisabled();
  await alertButton.click({ force: true });
  expect(await page.evaluate(() => (window as Window & { __geoCalls?: number }).__geoCalls ?? 0)).toBe(1);
  await page.evaluate(() => {
    const state = window as Window & { __resolveLocation?: PositionCallback };
    state.__resolveLocation?.({
      coords: { latitude: 10, longitude: 20, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
      timestamp: Date.now(),
      toJSON: () => ({}),
    });
  });
  await expect(page.getByText(/Hiện chưa thể gửi cảnh báo vị trí/i)).toBeVisible();
  expect(postCount).toBe(1);
});

test("shows unsupported-browser location guidance", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", { configurable: true, value: undefined });
  });
  await serveTokenPage(page);
  await mockProfile(page, 200, { profile: baseProfile });

  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Gửi cảnh báo vị trí" }).click();
  await expect(page.getByText(/không hỗ trợ chia sẻ vị trí/i)).toBeVisible();
});

test("shows timeout and retryable service guidance", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(_success: PositionCallback, error: PositionErrorCallback) {
          error({ code: 3, message: "timeout" } as GeolocationPositionError);
        },
      },
    });
  });
  await serveTokenPage(page);
  await mockProfile(page, 200, { profile: baseProfile });

  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Gửi cảnh báo vị trí" }).click();
  await expect(page.getByText(/Không nhận được vị trí kịp thời/i)).toBeVisible();
});

test("shows retryable service guidance after the alert API fails", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition(success: PositionCallback) {
          success({
            coords: { latitude: 10, longitude: 20, accuracy: 10, altitude: null, altitudeAccuracy: null, heading: null, speed: null, toJSON: () => ({}) },
            timestamp: Date.now(),
            toJSON: () => ({}),
          });
        },
      },
    });
  });
  await serveTokenPage(page);
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "location_alert.service_unavailable", message: "safe" } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: baseProfile }) });
  });

  await page.goto(`/e/${token}`);
  await page.getByRole("button", { name: "Gửi cảnh báo vị trí" }).click();
  await expect(page.getByText(/Máy chủ tạm thời không thể gửi cảnh báo/i)).toBeVisible();
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
