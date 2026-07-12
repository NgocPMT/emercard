import { expect, test } from "playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /EmerCard/i })).toBeVisible();
});

test("login page renders a bootstrap or auth shell state", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /Truy cập tài khoản EmerCard|Không thể kiểm tra phiên/i })).toBeVisible();
});

test("register page renders a bootstrap or auth shell state", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { name: /Tạo tài khoản EmerCard|Không thể kiểm tra phiên/i })).toBeVisible();
});

test("protected user route does not leak authenticated content without a session", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByText(/xác thực phiên|không thể tải phiên|không thể kiểm tra phiên/i)).toBeVisible();
});

test("public emergency route stays public", async ({ page }) => {
  await page.goto("/e/");
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: /Thông tin y tế khẩn cấp/i })).toBeVisible();
});
