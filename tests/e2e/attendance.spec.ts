import { test, expect } from "@playwright/test";

test.describe("Attendance - Employee Dashboard", () => {
  test.use({ storageState: "playwright/.auth/employee.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("should show attendance card with current time", async ({ page }) => {
    await expect(page.locator("h1")).toContainText("Absensi Hari Ini");
    // Check clock is displayed
    await expect(page.locator(".font-mono.text-4xl")).toBeVisible();
  });

  test("should show check-in button when not checked in", async ({ page }) => {
    await expect(page.locator('button:has-text("ABSEN MASUK")')).toBeVisible();
  });

  test("check-in with manual method", async ({ page }) => {
    await page.click('button:has-text("ABSEN MASUK")');
    await page.click('[role="radio"]:has-text("Pagi")'); // shift wajib dipilih sebelum metode
    // Method selector should appear
    await expect(page.locator('button:has-text("Manual")')).toBeVisible();
    await page.click('button:has-text("Manual")');
    // Should show success state
    await expect(page.locator('button:has-text("ABSEN PULANG")')).toBeVisible({ timeout: 10000 });
  });

  test("check-out after check-in", async ({ page }) => {
    // Assuming already checked in from previous test or setup
    // Click check-out
    await page.click('button:has-text("ABSEN PULANG")');
    await page.click('button:has-text("Manual")');
    // Should show completed state
    await expect(page.locator('button:has-text("Absensi selesai")')).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Attendance - History Page", () => {
  test.use({ storageState: "playwright/.auth/employee.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/attendance");
  });

  test("should show monthly attendance summary", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible(); // Month name
    // Check summary cards
    await expect(page.locator("dt:has-text('Hadir')")).toBeVisible();
    await expect(page.locator("dt:has-text('Jam kerja')")).toBeVisible();
  });

  test("should navigate between months", async ({ page }) => {
    const monthText = await page.locator("h1").textContent();
    await page.click('button[aria-label="Bulan berikutnya"]');
    await expect(page.locator("h1")).not.toHaveText(monthText || "");
    await page.click('button[aria-label="Bulan sebelumnya"]');
    await expect(page.locator("h1")).toHaveText(monthText || "");
  });
});

test.describe("Attendance - Selfie Capture", () => {
  test.use({ storageState: "playwright/.auth/employee.json" });

  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
    // Grant camera and geolocation permissions
    await page.context().grantPermissions(["camera", "geolocation"]);
  });

  test("should open selfie capture modal", async ({ page }) => {
    await page.click('button:has-text("ABSEN MASUK")');
    await page.click('[role="radio"]:has-text("Pagi")'); // shift wajib dipilih sebelum metode
    await page.click('button:has-text("Selfie")');
    // Camera preview should be visible
    await expect(page.locator("video")).toBeVisible({ timeout: 10000 });
  });

  test("should show geolocation status", async ({ page }) => {
    await page.click('button:has-text("ABSEN MASUK")');
    await page.click('[role="radio"]:has-text("Pagi")'); // shift wajib dipilih sebelum metode
    await page.click('button:has-text("Selfie")');
    // GPS status should be shown
    await expect(page.locator("text=GPS")).toBeVisible({ timeout: 10000 });
  });
});