import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    // Root page should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test("should show login form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Masuk");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("Masuk");
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.fill('input[type="email"]', "invalid@example.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    
    await expect(page.locator(".alert-error")).toContainText("Email atau password salah");
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    // Use admin credentials from .env.local
    const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
    const password = process.env.SEED_ADMIN_PASSWORD || "password";
    
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    
    // Should redirect to admin dashboard (since admin role)
    await expect(page).toHaveURL(/\/admin/);
  });
});