import { describe, expect, it, vi } from "vitest";

import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { OAuthStateRepository } from "~/modules/auth/infrastructure/OAuthStateRepository";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";

import { completeMcpOAuthConnection } from "../mcp-oauth-connections";

function createContext(record: unknown) {
  const upsertConnection = vi.fn();

  return {
    upsertConnection,
    context: {
      env: { JWT_SECRET: "x".repeat(40), API_BASE_URL: "https://api.example.com" },
      repositories: fakeRepositories([
        [OAuthStateRepository, { consumeByStateHash: vi.fn(async () => record) }],
        [ProviderConnectionRepository, { upsertConnection }],
      ]),
    } as never,
  };
}

describe("completeMcpOAuthConnection", () => {
  it("ignores an unknown state", async () => {
    const { context, upsertConnection } = createContext(null);

    await expect(
      completeMcpOAuthConnection(context, { state: "unknown", code: "code" }),
    ).resolves.toEqual({ connected: false });
    expect(upsertConnection).not.toHaveBeenCalled();
  });

  it("ignores an expired sign-in", async () => {
    const { context, upsertConnection } = createContext({
      provider: "mcp",
      codeVerifier: "verifier",
      redirectUri: "https://api.example.com/tools/mcp_connections/callback",
      context: {},
      createdAt: new Date(0),
      expiresAt: new Date(1),
    });

    await expect(
      completeMcpOAuthConnection(context, { state: "state", code: "code" }),
    ).resolves.toEqual({ connected: false });
    expect(upsertConnection).not.toHaveBeenCalled();
  });
});
