import { describe, test, expect } from "bun:test";
import { graphqlRequest, expectData, HAS_TOKEN } from "../client/graphqlClient";
import { POSTS_QUERY, type PostsData, type PostsVariables } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("rate limiting contract", () => {
  test("every response advertises the complexity quota", async () => {
    const res = await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 });
    expectData(res);

    expect(res.rateLimit.limit).toBeGreaterThan(0);
    expect(res.rateLimit.remaining).not.toBeNull();
    expect(res.rateLimit.remaining!).toBeLessThanOrEqual(res.rateLimit.limit!);
    expect(res.rateLimit.reset).toBeGreaterThan(0);
    expect(res.rateLimit.reset!).toBeLessThanOrEqual(15 * 60);
    console.log(`[RATE LIMIT] ${res.rateLimit.remaining}/${res.rateLimit.limit} points, reset in ${res.rateLimit.reset}s`);
  });

  test("every request consumes quota (cost logged, see findings F8)", async () => {
    const cheap = await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 });
    const expensive = await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 20 });
    const after = await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 });
    for (const r of [cheap, expensive, after]) expectData(r);

    const costOfExpensive = cheap.rateLimit.remaining! - expensive.rateLimit.remaining!;
    const costOfCheap = expensive.rateLimit.remaining! - after.rateLimit.remaining!;
    console.log(`[RATE LIMIT] cost: first:1 = ${costOfCheap} points, first:20 = ${costOfExpensive} points`);

    expect(costOfCheap).toBeGreaterThan(0);
    expect(costOfExpensive).toBeGreaterThan(0);
    expect(costOfExpensive).toBeGreaterThanOrEqual(costOfCheap);
  });

  test("a small concurrent burst is either served or 429'd, never a hard failure", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 }))
    );
    const rejected = results.filter((r) => r.status === "rejected");
    expect(rejected, "network-level failures").toEqual([]);

    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      expect([200, 429]).toContain(r.value.status);
    }
  });
});
