import { test, expect } from "@playwright/test";
import { loginAsUserA, loginAsUserB, requireE2EUsers } from "./helpers/auth.js";

test.describe("HyeBoard authenticated hardening", () => {
  test("login surface is usable on mobile widths", async ({ page }) => {
    const widths = [320, 375, 390, 430, 768];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
  });

  test("authenticated user can reach the notes workspace", async ({ page }) => {
    requireE2EUsers(test);
    await loginAsUserA(page);
    await expect(
      page.getByRole("heading", { name: /your notes/i }),
    ).toBeVisible();
  });

  test("cached navigation remains available while offline", async ({
    page,
    context,
  }) => {
    requireE2EUsers(test);
    await loginAsUserA(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("body")).not.toContainText(
      "Could not fetch this note",
    );
  });

  test("two-user sessions remain distinct", async ({ browser }) => {
    requireE2EUsers(test);
    const userA = await browser.newContext();
    const userB = await browser.newContext();
    try {
      const pageA = await userA.newPage();
      const pageB = await userB.newPage();
      await loginAsUserA(pageA);
      await loginAsUserB(pageB);
      await expect(pageA).not.toHaveURL(/login/);
      await expect(pageB).not.toHaveURL(/login/);
    } finally {
      await userA.close();
      await userB.close();
    }
  });
});
