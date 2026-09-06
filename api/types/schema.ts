export interface Topic {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  name: string;
  username: string;
  headline?: string | null;
}

export interface Post {
  id: string;
  name: string;
  tagline: string;
  slug: string;
  url: string;
  website?: string | null;
  votesCount: number;
  commentsCount: number;
  createdAt: string;
  featuredAt?: string | null;
  topics?: Connection<Topic>;
  makers?: User[];
}

export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage?: boolean;
  startCursor?: string | null;
  endCursor: string | null;
}

export interface Connection<T> {
  edges: Array<{ node: T; cursor?: string }>;
  pageInfo?: PageInfo;
  totalCount?: number;
}

export type PostConnection = Connection<Post> & { pageInfo: PageInfo; totalCount: number };

export type PostsOrder = "RANKING" | "NEWEST" | "VOTES" | "FEATURED_AT";

export interface Viewer {
  user: User | null;
}

export interface GraphQLErrorLocation {
  line: number;
  column: number;
}

export interface GraphQLSpecError {
  message: string;
  locations?: GraphQLErrorLocation[];
  path?: (string | number)[];
  extensions?: Record<string, unknown>;
}

export interface OAuthStyleError {
  error: string;
  error_description: string;
}

export type GraphQLError = GraphQLSpecError | OAuthStyleError;

export function isOAuthStyleError(e: GraphQLError): e is OAuthStyleError {
  return typeof (e as OAuthStyleError).error === "string";
}

export function errorMessage(e: GraphQLError): string {
  return isOAuthStyleError(e) ? `${e.error}: ${e.error_description}` : e.message;
}

export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: GraphQLError[];
}

export interface RateLimitInfo {
  limit: number | null;
  remaining: number | null;
  reset: number | null;
}

export interface GraphQLResult<T> {
  status: number;
  body: GraphQLResponse<T>;
  rateLimit: RateLimitInfo;
  requestId: string | null;
}
