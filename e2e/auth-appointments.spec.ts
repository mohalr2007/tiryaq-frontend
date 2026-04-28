import { test, expect } from "@playwright/test";

test("home navigation is reachable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("AI Assistant")).toBeVisible();
});

test("login page renders remember me", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Remember me")).toBeVisible();
});
