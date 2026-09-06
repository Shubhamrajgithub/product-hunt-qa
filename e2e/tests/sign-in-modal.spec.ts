import { test, expect, SELECTORS } from "../support/fixtures";

const PROVIDERS = ["linkedin", "github", "twitter", "google", "facebook", "apple"] as const;

test.describe("Sign-in modal", () => {
  test("header 'Sign in' opens the auth modal with all six providers and is dismissible", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    await page.locator(SELECTORS.headerSignIn).click();
    await expect(page.getByText(/sign (up|in) on product hunt/i)).toBeVisible();

    for (const provider of PROVIDERS) {
      await expect(page.locator(`[data-test="login-with-${provider}"]`), `${provider} button`).toBeVisible();
    }
    await expect(page.getByRole("button", { name: /sign in with linkedin/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with github/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with x/i })).toBeVisible();

    await expect(page.locator('input[type="password"]')).toHaveCount(0);

    await page.keyboard.press("Escape");
    await expect(page.locator('[data-test="login-with-github"]')).toBeHidden();
    await expect(page).toHaveURL(/producthunt\.com\/?(\?.*)?$/);
  });
});
