import { FullConfig, chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

async function globalSetup(config: FullConfig) {
  const authDir = path.join(__dirname, "playwright/.auth");
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login as admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "password";
  
  await page.goto("/login");
  await page.fill('input[type="email"]', adminEmail);
  await page.fill('input[type="password"]', adminPassword);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin");
  
  await context.storageState({ path: path.join(authDir, "admin.json") });
  console.log("✓ Admin auth state saved");

  // For employee, we'd need to create a test employee user
  // For now, we'll reuse admin or create a separate login flow
  // This is a placeholder - in real setup, create test employee via API
  await context.storageState({ path: path.join(authDir, "employee.json") });
  console.log("✓ Employee auth state saved (placeholder)");

  await browser.close();
}

export default globalSetup;