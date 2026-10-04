import type { IUser } from "~/types";

export function testUser(id: number, overrides: Partial<IUser> = {}): IUser {
  return {
    id,
    name: null,
    avatar_url: null,
    email: `user${id}@example.test`,
    github_username: null,
    company: null,
    site: null,
    location: null,
    bio: null,
    twitter_username: null,
    created_at: "2026-10-04T00:00:00Z",
    updated_at: "2026-10-04T00:00:00Z",
    setup_at: null,
    terms_accepted_at: null,
    plan_id: "pro",
    ...overrides,
  };
}
