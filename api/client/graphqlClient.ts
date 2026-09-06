import {
  errorMessage,
  type GraphQLResponse,
  type GraphQLResult,
  type RateLimitInfo,
} from "../types/schema";

export const PH_API_URL = process.env.PH_API_URL ?? "https://api.producthunt.com/v2/api/graphql";

export const ACCESS_TOKEN: string | undefined = process.env.PH_ACCESS_TOKEN?.trim() || undefined;
export const HAS_TOKEN = ACCESS_TOKEN !== undefined;

export class GraphQLClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "GraphQLClientError";
  }
}

export interface RequestOptions {
  token?: string | null;
  timeoutMs?: number;
  rawBody?: string;
  method?: "POST" | "GET";
}

function readInt(headers: Headers, name: string): number | null {
  const v = headers.get(name);
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function graphqlRequest<TData = unknown, TVariables extends Record<string, unknown> = Record<string, unknown>>(
  query: string,
  variables?: TVariables,
  options: RequestOptions = {}
): Promise<GraphQLResult<TData>> {
  const token = options.token === undefined ? ACCESS_TOKEN : options.token;
  const timeoutMs = options.timeoutMs ?? 15_000;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(PH_API_URL, {
      method: options.method ?? "POST",
      headers,
      body:
        (options.method ?? "POST") === "GET"
          ? undefined
          : options.rawBody ?? JSON.stringify({ query, variables: variables ?? {} }),
      signal: controller.signal,
    });

    const text = await res.text();
    let body: GraphQLResponse<TData>;
    try {
      body = text.length ? (JSON.parse(text) as GraphQLResponse<TData>) : {};
    } catch {
      const hint =
        res.status === 403 && /cloudflare|cf-chl|attention required/i.test(text)
          ? " (Cloudflare challenge, not an API response. Retry or lower concurrency.)"
          : "";
      throw new GraphQLClientError(`HTTP ${res.status}: response was not JSON${hint}`, res.status, text.slice(0, 500));
    }

    const rateLimit: RateLimitInfo = {
      limit: readInt(res.headers, "x-rate-limit-limit"),
      remaining: readInt(res.headers, "x-rate-limit-remaining"),
      reset: readInt(res.headers, "x-rate-limit-reset"),
    };

    return { status: res.status, body, rateLimit, requestId: res.headers.get("x-request-id") };
  } finally {
    clearTimeout(timer);
  }
}

export function expectData<T>(result: GraphQLResult<T>): T {
  const { body, status } = result;
  if (status === 429) {
    throw new GraphQLClientError(
      `HTTP 429: quota exhausted (${result.rateLimit.remaining}/${result.rateLimit.limit}), resets in ${result.rateLimit.reset}s. ` +
        `Every request costs 100 points (findings F8), so the suite fits about twice per 15 min.`,
      status,
      body
    );
  }
  if (body.errors && body.errors.length > 0) {
    throw new GraphQLClientError(
      `HTTP ${status}: ${body.errors.map(errorMessage).join("; ")}`,
      status,
      body
    );
  }
  if (body.data === undefined || body.data === null) {
    throw new GraphQLClientError(`HTTP ${status}: no data and no errors`, status, body);
  }
  return body.data;
}
