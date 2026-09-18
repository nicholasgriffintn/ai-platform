import { describe, expect, it } from "vitest";

import type { User } from "~/types";

import { generateJwtToken, verifyJwtToken } from "../jwt";

const secret = "assistant-test-secret-with-at-least-32-bytes";
const user: User = {
  id: 123,
  name: "Test User",
  avatar_url: null,
  email: "test@example.com",
  github_username: null,
  company: null,
  site: null,
  location: null,
  bio: null,
  twitter_username: null,
  role: "user",
  created_at: "2026-07-30T00:00:00.000Z",
  updated_at: "2026-07-30T00:00:00.000Z",
  setup_at: null,
  terms_accepted_at: null,
  plan_id: "free",
};

describe("JWT service", () => {
  it("round-trips the Assistant issuer, audience and user claims", async () => {
    const token = await generateJwtToken(user, secret, 300);
    const claims = await verifyJwtToken(token, secret);

    expect(claims).toMatchObject({
      sub: "123",
      email: "test@example.com",
      name: "Test User",
      iss: "assistant",
      aud: "assistant",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await generateJwtToken(user, secret, 300);

    await expect(
      verifyJwtToken(token, "different-secret-that-is-also-at-least-32-bytes"),
    ).rejects.toMatchObject({
      message: "Invalid or expired authentication token",
      statusCode: 401,
    });
  });
});
