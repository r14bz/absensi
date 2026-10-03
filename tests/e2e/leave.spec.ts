import { test, expect } from "@playwright/test";

test.describe("Leave Requests", () => {
  test.use({ storageState: "playwright/.auth/employee.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/leave");
  });

  test("should show leave request form", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Izin / Sakit");
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button:has-text("Kirim pengajuan")')).toBeVisible();
  });

  test("should submit leave request", async ({ page }) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];

    await page.fill('input[type="date"]', dateStr);
    await page.selectOption('select', "SICK");
    await page.fill('textarea', "Sakit demam, perlu istirahat");
    await page.click('button:has-text("Kirim pengajuan")');

    await expect(page.locator(".alert-ok")).toContainText("Pengajuan terkirim");
  });

  test("should show leave history", async ({ page }) => {
    await expect(page.locator("text=Pengajuan saya")).toBeVisible();
  });
});

test.describe("Admin Leave Management", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin/leaves");
  });

  test("should show pending leave requests", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Izin");
  });
});