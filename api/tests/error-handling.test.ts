import { describe, test, expect } from "bun:test";
import { graphqlRequest, HAS_TOKEN } from "../client/graphqlClient";
import { errorMessage, isOAuthStyleError } from "../types/schema";
import { SYNTAX_ERROR_QUERY, UNKNOWN_FIELD_QUERY, WRONG_ARG_TYPE_QUERY } from "../fixtures";

describe.skipIf(!HAS_TOKEN)("GraphQL validation errors", () => {
  const cases = [
    ["wrong argument type", WRONG_ARG_TYPE_QUERY, /Int|type|first/i],
    ["unknown field", UNKNOWN_FIELD_QUERY, /definitelyNotARealField|doesn't exist|Cannot query/i],
    ["syntax error", SYNTAX_ERROR_QUERY, /syntax|parse|unexpected|expected/i],
  ] as const;

  for (const [label, query, messagePattern] of cases) {
    test(`${label} gives a structured GraphQL error that names the problem`, async () => {
      const res = await graphqlRequest(query);

      expect(res.status).toBeLessThan(500);
      expect(res.body.errors?.length).toBeGreaterThan(0);

      const err = res.body.errors![0]!;
      expect(isOAuthStyleError(err), "validation errors use the spec `message` key").toBe(false);
      const msg = errorMessage(err);
      expect(msg).toMatch(messagePattern);
      expect(msg.toLowerCase()).not.toMatch(/stack|traceback|\.rb:|internal server error/);
    });
  }
});
