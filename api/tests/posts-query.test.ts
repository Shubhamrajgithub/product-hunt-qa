import { describe, test, expect } from "bun:test";
import { graphqlRequest, expectData, HAS_TOKEN } from "../client/graphqlClient";
import { POSTS_QUERY, type PostsData, type PostsVariables } from "../fixtures";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

describe.skipIf(!HAS_TOKEN)("posts query", () => {
  test("returns a well-formed page of posts", async () => {
    const data = expectData(await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 5 }));

    expect(data.posts.edges.length).toBeGreaterThan(0);
    expect(data.posts.edges.length).toBeLessThanOrEqual(5);
    expect(typeof data.posts.totalCount).toBe("number");
    expect(typeof data.posts.pageInfo.hasNextPage).toBe("boolean");

    for (const { node, cursor } of data.posts.edges) {
      expect(cursor).toBeTruthy();
      expect(node.id).toMatch(/^\d+$/);
      expect(node.name.trim().length).toBeGreaterThan(0);
      expect(node.slug).toMatch(/^[a-z0-9-]+$/);
      expect(node.url).toMatch(/^https:\/\/www\.producthunt\.com\//);
      expect(node.votesCount).toBeGreaterThanOrEqual(0);
      expect(node.commentsCount).toBeGreaterThanOrEqual(0);
      expect(node.createdAt).toMatch(ISO_DATE);
    }
  });

  test("first: 0 returns an empty page, not an error", async () => {
    const data = expectData(await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 0 }));
    expect(data.posts.edges).toEqual([]);
  });

  test("postedAfter/postedBefore window is honoured", async () => {
    const before = new Date();
    const after = new Date(before.getTime() - 7 * 24 * 3600 * 1000);
    const data = expectData(
      await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, {
        first: 20,
        order: "NEWEST",
        postedAfter: after.toISOString(),
        postedBefore: before.toISOString(),
      })
    );
    expect(data.posts.edges.length).toBeGreaterThan(0);
    for (const { node } of data.posts.edges) {
      const t = new Date(node.createdAt).getTime();
      expect(t).toBeGreaterThanOrEqual(after.getTime());
      expect(t).toBeLessThanOrEqual(before.getTime());
    }
  });
});
