import { test, expect } from "@playwright/test";

test("community route responds", async ({ page }) => {
  const response = await page.goto("/community");
  expect(response?.status()).toBeLessThan(500);
});

test("ai assistant disclaimer visible", async ({ page }) => {
  await page.goto("/ai-assistant");
  await expect(page.getByText("recommendation d'orientation", { exact: false })).toBeVisible();
});
