import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Search", () => {
  test("typing in the header palette suggests matches and Enter opens full results", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    await page.locator(SELECTORS.headerSearch).click();
    const palette = page.getByPlaceholder(/search for products/i);
    await expect(palette).toBeVisible();

    // fill() is ignored here, palette listens to key events
    await palette.pressSequentially("notion", { delay: 50 });
    await expect(palette).toHaveValue("notion");
    await expect(page.getByRole("link", { name: /^notion$/i }).first()).toBeVisible();

    await palette.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=notion/);

    const results = page.locator(SELECTORS.searchResult);
    await expect(results.first()).toBeVisible();
    await expect(results.first()).toContainText(/notion/i);
    expect(await results.count()).toBeGreaterThan(1);

    const ids = await results.evaluateAll((els) => els.map((el) => el.getAttribute("data-test")));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
