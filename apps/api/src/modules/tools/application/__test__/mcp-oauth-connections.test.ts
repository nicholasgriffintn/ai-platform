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

  it("refuses a code returned by a different issuer before exchanging it", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    const { context, upsertConnection } = createContext({
      provider: "mcp",
      codeVerifier: "verifier",
      redirectUri: "https://api.example.com/tools/mcp_connections/callback",
      context: {
        userId: "1",
        label: "Tracker",
        url: "https://mcp.example.com/mcp",
        allowedTools: "[]",
        resource: "https://mcp.example.com/mcp",
        server: JSON.stringify({
          issuer: "https://auth.example.com",
          authorizationEndpoint: "https://auth.example.com/authorize",
          tokenEndpoint: "https://auth.example.com/token",
        }),
        client: JSON.stringify({ clientId: "client" }),
      },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      completeMcpOAuthConnection(context, {
        state: "state",
        code: "code",
        iss: "https://evil.example.com",
      }),
    ).resolves.toEqual({ connected: false });
    expect(fetch).not.toHaveBeenCalled();
    expect(upsertConnection).not.toHaveBeenCalled();
    fetch.mockRestore();
  });
});
