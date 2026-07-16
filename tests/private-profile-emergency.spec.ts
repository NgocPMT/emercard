import { expect, test } from "playwright/test";

const malformedEnvelope = {
  version: 1,
  kdf: {
    algorithm: "argon2id",
    salt: "c2FsdA",
    memory_cost_kib: 65_536,
    time_cost: 3,
    parallelism: 1,
  },
  nonce: "bm9uY2U",
  ciphertext: "Y2lwaGVydGV4dA",
  access_code_wrap: {
    algorithm: "aes-256-gcm",
    nonce: "bm9uY2U",
    ciphertext: "d3JhcA",
  },
  recovery_key_wrap: {
    algorithm: "aes-256-gcm",
    nonce: "bm9uY2U",
    ciphertext: "d3JhcA",
  },
};

test("loads emergency styles without CSP violations", async ({ page }) => {
  const cspViolations: string[] = [];
  page.on("console", (message) => {
    if (
      message.text().includes("style-src") ||
      message.text().includes("script-src")
    )
      cspViolations.push(message.text());
  });

  await page.goto("/e/missing-token");
  await expect(page.locator("body")).toHaveClass(/bg-background/);
  expect(cspViolations).toEqual([]);
});

test("unlocks a valid envelope locally with the same profile binding", async ({
  page,
}) => {
  const accessCode = "correct horse battery staple";
  await page.goto("/e/missing-token");
  const envelope = await page.evaluate(
    async ({ profileId, accessCode }) => {
      const modulePath: string = "/src/lib/private-profile-crypto.ts";
      const crypto = await import(modulePath);
      const result = await crypto.createPrivateProfileEnvelope(
        profileId,
        accessCode,
        {
          address: "12 Example Street",
          citizen_id: "012345678901",
          sensitive_conditions: ["Epilepsy"],
        },
      );
      return result.envelope;
    },
    { profileId: "profile-e2e", accessCode },
  );

  await page.route("**/api/v1/public/test-token", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          profile_id: "profile-e2e",
          display_name: "Emergency User",
          birth_year: 1995,
          gender: "male",
          blood_type: "O+",
          critical_allergies: [],
          important_conditions: [],
          critical_medications: [],
          emergency_note: null,
          private_profile_envelope: envelope,
          emergency_contacts: [],
          profile_updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    }),
  );

  await page.goto("/e/test-token");
  await page.locator("#private-access-code").fill(accessCode);
  await page.locator("#private-unlock-button").click();
  await expect(page.locator("#private-details")).toBeVisible();
  await expect(page.locator("#private-details dd").first()).toHaveText(
    "12 Example Street",
  );
});

test("keeps private details locked and does not send the access code", async ({
  page,
}) => {
  const accessCode = "correct horse battery staple";
  const requests: Array<{ url: string; postData: string | null }> = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/v1/public/"))
      requests.push({ url: request.url(), postData: request.postData() });
  });
  await page.route("**/api/v1/public/test-token", async (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        profile: {
          profile_id: "profile-e2e",
          display_name: "Emergency User",
          birth_year: 1995,
          gender: "male",
          blood_type: "O+",
          critical_allergies: ["Penicillin"],
          important_conditions: ["Asthma"],
          critical_medications: [],
          emergency_note: null,
          private_profile_envelope: malformedEnvelope,
          emergency_contacts: [],
          profile_updated_at: "2026-01-01T00:00:00Z",
        },
      }),
    }),
  );

  await page.goto("/e/test-token");
  await expect(page.locator("#private-details-section")).toBeVisible();
  await expect(page.locator("#private-details dt")).toHaveCount(0);

  await page.locator("#private-access-code").fill(accessCode);
  await page.locator("#private-unlock-button").click();
  await expect(page.locator("#private-details-status")).toHaveText(
    "Không thể mở khóa thông tin riêng tư.",
  );
  await expect(page.locator("#private-details dt")).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.url).not.toContain(accessCode);
  expect(requests[0]?.postData ?? "").not.toContain(accessCode);
});
