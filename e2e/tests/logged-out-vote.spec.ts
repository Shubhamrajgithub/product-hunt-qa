import { test, expect, SELECTORS } from "../support/fixtures";

test.describe("Logged-out voting", () => {
  test("clicking upvote while signed out prompts sign-in instead of failing silently", async ({
    page,
    gotoOnce,
    feed,
  }) => {
    // known bug (findings F1), flips red when fixed
    test.fail(true, "F1: logged-out upvote is a silent no-op (no sign-in prompt)");

    await gotoOnce("/");
    await feed.waitForToday();

    const vote = feed.todayCards.first().locator(SELECTORS.voteButton);
    const before = (await vote.innerText()).trim();
    await vote.click();

    await expect(page.getByRole("button", { name: /sign in with github/i })).toBeVisible({ timeout: 5_000 });
    await expect(vote).toHaveText(before);
  });
});
