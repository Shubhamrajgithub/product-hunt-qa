import { test, expect, Feed } from "../support/fixtures";

test.describe("Today's launches expansion", () => {
  test("'See all' expands the teaser into a complete, rank-ordered list", async ({
    gotoOnce,
    feed,
  }) => {
    await gotoOnce("/");
    await feed.waitForToday();

    const teaserSlugs = await Feed.productSlugs(feed.today);
    const teaserCount = await feed.todayCards.count();
    expect(teaserSlugs.length).toBeGreaterThan(0);

    await expect(feed.seeAllToday).toBeVisible();
    await feed.seeAllToday.click();

    await expect.poll(() => feed.todayCards.count(), { timeout: 30_000 }).toBeGreaterThan(teaserCount);
    await expect(feed.seeAllToday).toBeHidden();

    const rows = await feed.todayCards.evaluateAll((els) =>
      els.map((el) => {
        const link = el.querySelector('a[href^="/products/"]');
        const rank = (link?.textContent ?? "").match(/^\s*(\d+)\./);
        const votes = el.querySelector('[data-test="vote-button"]')?.textContent ?? "";
        return {
          slug: link?.getAttribute("href")?.split("?")[0] ?? "",
          rank: rank ? Number(rank[1]) : null,
          votes: Number(votes.replace(/[^\d]/g, "")) || 0,
        };
      })
    );

    const expandedSlugs = new Set(rows.map((r) => r.slug));
    for (const slug of teaserSlugs) {
      expect(expandedSlugs.has(slug), `${slug} survives expansion`).toBe(true);
    }

    let voteInversions = 0;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!;
      const cur = rows[i]!;
      if (prev.rank !== null && cur.rank !== null) {
        expect(cur.rank, `rank at row ${i + 1} (${cur.slug}) is not lower than the row above`).toBeGreaterThanOrEqual(prev.rank);
      }
      if (cur.votes > prev.votes) voteInversions++;
    }
    test.info().annotations.push({ type: "rows", description: String(rows.length) });
    test.info().annotations.push({ type: "vote-order-inversions", description: String(voteInversions) });

    expect(rows.filter((r) => !r.slug).length, "rows without a product link").toBe(0);

    const seen = new Map<string, number>();
    for (const r of rows) seen.set(r.slug, (seen.get(r.slug) ?? 0) + 1);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([s, n]) => `${s} ×${n}`);
    test.info().annotations.push({
      type: "duplicates",
      description: dupes.length ? dupes.join(", ") : "none",
    });
  });
});
