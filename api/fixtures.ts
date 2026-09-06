import type { Post, PostConnection, PostsOrder, Viewer } from "./types/schema";

export const VIEWER_QUERY = /* GraphQL */ `
  query Viewer {
    viewer {
      user { id name username }
    }
  }
`;
export type ViewerData = { viewer: Viewer | null };

export const POSTS_QUERY = /* GraphQL */ `
  query Posts($first: Int, $after: String, $order: PostsOrder, $postedAfter: DateTime, $postedBefore: DateTime) {
    posts(first: $first, after: $after, order: $order, postedAfter: $postedAfter, postedBefore: $postedBefore) {
      totalCount
      pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
      edges {
        cursor
        node { id name tagline slug url votesCount commentsCount createdAt featuredAt }
      }
    }
  }
`;
export type PostsVariables = {
  first?: number;
  after?: string | null;
  order?: PostsOrder;
  postedAfter?: string;
  postedBefore?: string;
};
export type PostsData = { posts: PostConnection };

export const POST_BY_ID_QUERY = /* GraphQL */ `
  query PostById($id: ID, $slug: String) {
    post(id: $id, slug: $slug) {
      id name tagline slug url website votesCount commentsCount createdAt featuredAt
      topics(first: 5) { edges { node { id name slug } } }
      makers { id name username }
    }
  }
`;
export type PostData = { post: Post | null };

export const USER_FOLLOW_MUTATION = /* GraphQL */ `
  mutation FollowUser($userId: ID!) {
    userFollow(input: { userId: $userId }) {
      errors { field message }
      node { id username isFollowing }
    }
  }
`;

export const INTROSPECTION_QUERY = /* GraphQL */ `
  query IntrospectionProbe {
    __schema {
      queryType { name }
      mutationType { name fields { name } }
    }
  }
`;
export type IntrospectionData = {
  __schema: { queryType: { name: string }; mutationType: { name: string; fields: { name: string }[] } | null };
};

export const WRONG_ARG_TYPE_QUERY = /* GraphQL */ `
  query WrongArgType {
    posts(first: "not-a-number") { edges { node { id } } }
  }
`;

export const UNKNOWN_FIELD_QUERY = /* GraphQL */ `
  query UnknownField {
    posts(first: 1) { edges { node { id definitelyNotARealField } } }
  }
`;

export const SYNTAX_ERROR_QUERY = `query { posts(first: 1) { edges { node { id }`;
