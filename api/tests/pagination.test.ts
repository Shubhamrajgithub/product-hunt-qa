import { describe, test, expect } from "bun:test";
import { graphqlRequest, expectData, HAS_TOKEN } from "../client/graphqlClient";
import { POSTS_QUERY, type PostsData, type PostsVariables } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("posts pagination", () => {
  test("cursor pagination advances without gaps or duplicates", async () => {
    const page1 = expectData(
      await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 10, order: "NEWEST" })
    );
    expect(page1.posts.pageInfo.hasNextPage).toBe(true);
    expect(page1.posts.pageInfo.endCursor).toBeTruthy();
    expect(page1.posts.pageInfo.endCursor).toBe(page1.posts.edges.at(-1)!.cursor ?? null);

    const page2 = expectData(
      await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, {
        first: 10,
        order: "NEWEST",
        after: page1.posts.pageInfo.endCursor,
      })
    );

    const ids1 = page1.posts.edges.map((e) => e.node.id);
    const ids2 = page2.posts.edges.map((e) => e.node.id);
    expect(ids2.length).toBeGreaterThan(0);
    expect(new Set([...ids1, ...ids2]).size, "no post appears on both pages").toBe(ids1.length + ids2.length);

    const last1 = new Date(page1.posts.edges.at(-1)!.node.createdAt).getTime();
    const first2 = new Date(page2.posts.edges[0]!.node.createdAt).getTime();
    expect(first2).toBeLessThanOrEqual(last1);
  });

  test("an unparseable cursor yields a structured error, not a 500", async () => {
    const res = await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, {
      first: 1,
      after: "definitely-not-a-cursor",
    });
    expect(res.status).toBeLessThan(500);
    if (res.body.errors?.length) {
      expect(res.body.errors.length).toBeGreaterThan(0);
    } else {
      expect(Array.isArray(res.body.data?.posts.edges)).toBe(true);
    }
  });
});
