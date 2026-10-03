import { test, expect } from "@playwright/test";

test.describe("Admin Panel", () => {
  test.use({ storageState: "playwright/.auth/admin.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
  });

  test("should show daily attendance recap", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Rekap harian");
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator("dt:has-text('Hadir')")).toBeVisible();
    await expect(page.locator("dt:has-text('Tidak hadir')")).toBeVisible();
  });

  test("should export monthly attendance to Excel", async ({ page }) => {
    await expect(page.locator("text=Export Rekap Bulanan ke Excel")).toBeVisible();
    await page.selectOption('#export-year', '2025');
    await page.selectOption('#export-month', '1');
    const downloadPromise = page.waitForEvent("download");
    await page.click('button:has-text("Export ke Excel")');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/rekap-absensi-\d{4}-\d{2}\.xlsx/);
  });

  test("should navigate to leaves page", async ({ page }) => {
    await page.goto("/admin/leaves");
    await expect(page.locator("h1")).toContainText("Izin");
  });

  test("should navigate to employees page", async ({ page }) => {
    await page.goto("/admin/employees");
    await expect(page.locator("h1")).toContainText("Karyawan");
  });
});