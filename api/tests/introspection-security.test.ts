import { describe, test, expect } from "bun:test";
import { graphqlRequest, HAS_TOKEN } from "../client/graphqlClient";
import { INTROSPECTION_QUERY, type IntrospectionData } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("introspection exposure", () => {
  test("introspection state is known and the mutation surface matches the docs", async () => {
    const res = await graphqlRequest<IntrospectionData>(INTROSPECTION_QUERY);
    expect(res.status).toBe(200);

    const enabled = !!res.body.data?.__schema;
    console.log(`[INTROSPECTION] ${enabled ? "ENABLED" : "DISABLED"} for authenticated clients`);

    if (!enabled) {
      expect(res.body.errors?.length).toBeGreaterThan(0);
      return;
    }

    const mutations = (res.body.data!.__schema.mutationType?.fields ?? []).map((f) => f.name).sort();
    console.log(`[INTROSPECTION] mutations: ${mutations.join(", ")}`);
    const documented = ["userFollow", "userFollowUndo", "userSelect"];
    const undocumented = mutations.filter((m) => !documented.includes(m));
    expect(undocumented, "mutations exposed but absent from the public docs").toEqual([]);
  }, 20_000);
});
