import { describe, test, expect } from "bun:test";
import { graphqlRequest, PH_API_URL } from "../client/graphqlClient";
import { isOAuthStyleError, errorMessage } from "../types/schema";
import { POSTS_QUERY, USER_FOLLOW_MUTATION, VIEWER_QUERY, type PostsData, type ViewerData } from "../fixtures";

describe("authorization boundaries (no token required)", () => {
  test("public read without a token is refused with 401 and a structured error", async () => {
    const res = await graphqlRequest<PostsData>(POSTS_QUERY, { first: 1 }, { token: null });

    expect(res.status).toBe(401);
    expect(res.body.data).toBeNull();
    expect(res.body.errors?.length).toBeGreaterThan(0);

    const err = res.body.errors![0]!;
    expect(isOAuthStyleError(err)).toBe(true);
    if (isOAuthStyleError(err)) expect(err.error).toBe("invalid_oauth_token");
  });

  test("a forged bearer token is rejected identically to no token (no oracle)", async () => {
    const [noToken, forged] = await Promise.all([
      graphqlRequest<ViewerData>(VIEWER_QUERY, {}, { token: null }),
      graphqlRequest<ViewerData>(VIEWER_QUERY, {}, { token: "forged-token-" + "a".repeat(40) }),
    ]);

    expect(forged.status).toBe(401);
    expect(forged.body.data).toBeNull();
    expect(forged.status).toBe(noToken.status);
    expect(forged.body.errors?.map((e) => (isOAuthStyleError(e) ? e.error : e.message))).toEqual(
      noToken.body.errors?.map((e) => (isOAuthStyleError(e) ? e.error : e.message))
    );
  });

  test("a write (userFollow) without a token is refused and returns no node", async () => {
    const res = await graphqlRequest<{ userFollow: unknown }>(USER_FOLLOW_MUTATION, { userId: "1" }, { token: null });

    expect(res.status).toBe(401);
    expect(res.body.data ?? null).toBeNull();
    expect(res.body.errors?.length).toBeGreaterThan(0);
  });

  test("error text never leaks implementation details", async () => {
    const res = await graphqlRequest<PostsData>(POSTS_QUERY, { first: 1 }, { token: null });
    const text = (res.body.errors ?? []).map(errorMessage).join(" ").toLowerCase();

    for (const needle of ["stack", "traceback", "/app/", "ruby", "rails", "postgres", "internal server error"]) {
      expect(text, `error text must not contain "${needle}"`).not.toContain(needle);
    }
  });
});

describe("transport hardening (no token required)", () => {
  test("GET is not an accepted transport for the GraphQL endpoint", async () => {
    const res = await fetch(`${PH_API_URL}?query=${encodeURIComponent("{ __typename }")}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    expect([404, 405]).toContain(res.status);
  });

  test("a non-JSON body is rejected with 400, not a 500", async () => {
    let status: number | undefined;
    try {
      const res = await graphqlRequest(POSTS_QUERY, undefined, { token: null, rawBody: "this is not json" });
      status = res.status;
    } catch (e) {
      status = (e as { status?: number }).status;
    }
    expect(status).toBe(400);
  });

  test("responses carry baseline security headers", async () => {
    const res = await fetch(PH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "{ __typename }" }),
    });

    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toMatch(/SAMEORIGIN|DENY/i);
    expect(res.headers.get("strict-transport-security")).toMatch(/max-age=\d+/);
    expect(res.headers.get("x-request-id"), "request id for support correlation").toBeTruthy();
  });
});
