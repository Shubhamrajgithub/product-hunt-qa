import { describe, test, expect } from "bun:test";
import { graphqlRequest, expectData, HAS_TOKEN } from "../client/graphqlClient";
import { POSTS_QUERY, type PostsData, type PostsVariables } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("posts ordering", () => {
  test("order: VOTES is non-increasing by votesCount", async () => {
    const data = expectData(
      await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 20, order: "VOTES" })
    );
    const votes = data.posts.edges.map((e) => e.node.votesCount);
    expect(votes.length).toBeGreaterThan(1);
    for (let i = 1; i < votes.length; i++) {
      expect(votes[i]!, `position ${i} not greater than position ${i - 1}`).toBeLessThanOrEqual(votes[i - 1]!);
    }
  });

  test("order: NEWEST is non-increasing by createdAt", async () => {
    const data = expectData(
      await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 20, order: "NEWEST" })
    );
    const times = data.posts.edges.map((e) => new Date(e.node.createdAt).getTime());
    expect(times.length).toBeGreaterThan(1);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]!).toBeLessThanOrEqual(times[i - 1]!);
    }
  });

  test("order: RANKING (default) and an explicit RANKING request agree", async () => {
    const [implicit, explicit] = await Promise.all([
      graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 5 }),
      graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 5, order: "RANKING" }),
    ]);
    const ids = (d: PostsData) => d.posts.edges.map((e) => e.node.id);
    expect(ids(expectData(implicit))).toEqual(ids(expectData(explicit)));
  });
});
