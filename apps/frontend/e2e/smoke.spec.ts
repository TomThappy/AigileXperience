import { test, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE || "http://localhost:3000";

test("loads home and generates deck (dry assume)", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByText("AigileXperience")).toBeVisible();
  await page.getByRole("button", { name: "Live + Assumptions" }).click();
  await expect(page.getByText("Ergebnis")).toBeVisible();
  await expect(page.getByText("Slides")).toBeVisible({ timeout: 15000 });
});
