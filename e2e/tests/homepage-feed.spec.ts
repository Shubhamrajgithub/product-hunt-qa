import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Homepage feed", () => {
  test("renders today's ranked launches with name, tagline and vote count", async ({
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    await expect(feed.today.getByRole("heading", { level: 1 })).toHaveText(/launching today/i);

    const cards = feed.todayCards;
    expect(await cards.count()).toBeGreaterThanOrEqual(5);

    for (let i = 0; i < 5; i++) {
      const card = cards.nth(i);
      const nameLink = card.locator(SELECTORS.productLink).filter({ hasText: /\S/ }).first();
      await expect(nameLink, `card ${i + 1} has a product link with a name`).toBeVisible();
      await expect(nameLink, `card ${i + 1} is numbered by rank`).toHaveText(
        new RegExp(`^${i + 1}\\.\\s+\\S`)
      );

      const votes = card.locator(SELECTORS.voteButton);
      await expect(votes, `card ${i + 1} has a vote control`).toBeVisible();
      await expect(votes, `card ${i + 1} shows a numeric vote count`).toHaveText(/^\s*\d[\d,.]*[Kk]?\s*$/);
    }
  });
});
