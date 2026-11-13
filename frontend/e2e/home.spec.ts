import { test, expect } from "@playwright/test";

test("workspace dashboard renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("flowboard")).toBeVisible();
  await expect(page.getByRole("heading", { name: /your overview/i })).toBeVisible();
});
