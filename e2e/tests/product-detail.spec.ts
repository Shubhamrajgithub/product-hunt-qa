import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Product detail page", () => {
  test("clicking a launch opens its product page and back returns to the feed", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    const firstCard = feed.todayCards.first();
    const nameLink = firstCard.locator(SELECTORS.productLink).filter({ hasText: /\S/ }).first();
    const href = (await nameLink.getAttribute("href"))!;
    const slug = href.split("?")[0]!;
    expect(slug).toMatch(/^\/products\/[^/]+$/);

    await nameLink.click();
    await expect(page).toHaveURL(new RegExp(`${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\?|$)`));

    const heading = page.getByRole("heading", { level: 1 }).first();
    await expect(heading).toBeVisible();
    await expect(heading).not.toBeEmpty();
    await expect(page.locator(SELECTORS.visitWebsite).first()).toBeVisible();
    await expect(page.locator(SELECTORS.productNav).first()).toBeVisible();
    await expect(page).toHaveTitle(/product hunt/i);

    await page.goBack();
    await expect(page).toHaveURL(/producthunt\.com\/?(\?.*)?$/);
    await feed.waitForToday();
  });
});
