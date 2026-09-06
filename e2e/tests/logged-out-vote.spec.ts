import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Logged-out voting", () => {
  test("clicking upvote while signed out prompts sign-in instead of failing silently", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    // known bug (findings F1), flips red when fixed. Set after the page loads so
    // a Cloudflare block on the way in still fails properly.
    test.fail(true, "F1: logged-out upvote is a silent no-op (no sign-in prompt)");

    const vote = feed.todayCards.first().locator(SELECTORS.voteButton);
    const before = (await vote.innerText()).trim();
    await vote.click();

    await expect(page.getByRole("button", { name: /sign in with github/i })).toBeVisible({ timeout: 5_000 });
    await expect(vote).toHaveText(before);
  });
});
