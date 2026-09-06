import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Mobile feed", () => {
  test("feed renders without horizontal overflow and stays usable on a phone viewport", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    expect(await feed.todayCards.count()).toBeGreaterThanOrEqual(5);

    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(overflows, "no horizontal scrollbar on mobile").toBe(false);

    await expect(page.locator(SELECTORS.headerSignIn)).toBeVisible();

    const lastCard = feed.todayCards.last();
    await lastCard.scrollIntoViewIfNeeded();
    await expect(lastCard).toBeInViewport();
    await expect(lastCard.locator(SELECTORS.voteButton)).toBeVisible();
  });
});
