import { describe, test, expect } from "bun:test";
import { graphqlRequest, expectData, HAS_TOKEN } from "../client/graphqlClient";
import { POSTS_QUERY, POST_BY_ID_QUERY, type PostData, type PostsData, type PostsVariables } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("post detail", () => {
  test("a post fetched by id matches the same post in the list", async () => {
    const list = expectData(await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 }));
    const fromList = list.posts.edges[0]!.node;

    const detail = expectData(await graphqlRequest<PostData>(POST_BY_ID_QUERY, { id: fromList.id })).post;
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(fromList.id);
    expect(detail!.slug).toBe(fromList.slug);
    expect(detail!.name).toBe(fromList.name);
    expect(detail!.tagline).toBe(fromList.tagline);
    expect(Math.abs(detail!.votesCount - fromList.votesCount)).toBeLessThanOrEqual(5);
    expect(Array.isArray(detail!.topics?.edges)).toBe(true);
    expect(Array.isArray(detail!.makers)).toBe(true);
  });

  test("id and slug lookups resolve to the same post", async () => {
    const list = expectData(await graphqlRequest<PostsData, PostsVariables>(POSTS_QUERY, { first: 1 }));
    const { id, slug } = list.posts.edges[0]!.node;

    const [byId, bySlug] = await Promise.all([
      graphqlRequest<PostData>(POST_BY_ID_QUERY, { id }),
      graphqlRequest<PostData>(POST_BY_ID_QUERY, { slug }),
    ]);
    expect(expectData(byId).post?.id).toBe(id);
    expect(expectData(bySlug).post?.id).toBe(id);
  });

  test("a non-existent id resolves to null, not an error or a 500", async () => {
    const res = await graphqlRequest<PostData>(POST_BY_ID_QUERY, { id: "999999999999" });
    expect(res.status).toBe(200);
    expect(res.body.data?.post ?? null).toBeNull();
  });
});
