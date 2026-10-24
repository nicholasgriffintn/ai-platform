import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { resolveTeammateConnectorAuthority } from "../connection-authority";

vi.mock("../access", () => ({ requireProjectTeammate: vi.fn(async () => ({})) }));

const USER_ID = 7;

function connection(overrides: Record<string, unknown>) {
  return {
    id: "conn_1",
    user_id: USER_ID,
    provider: "lastfm",
    kind: "recipe_connector",
    external_id: "",
    status: "connected",
    encrypted_data: "",
    metadata: "{}",
    created_at: "2026-10-24T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function createContext(params: {
  scope: { type: "personal" | "project"; id: string };
  connections: ReturnType<typeof connection>[];
}): ServiceContext {
  return {
    repositories: fakeRepositories([
      [
        TeammateContextRepository,
        {
          getById: vi.fn(async () => ({
            id: "ctx_1",
            teammateId: "poly",
            actorUserId: USER_ID,
            status: "active",
            scope: params.scope,
          })),
          listConnectionGrants: vi.fn(async () => []),
        },
      ],
      [
        ProviderConnectionRepository,
        {
          listConnections: vi.fn(async () => params.connections),
          getConnectionById: vi.fn(async () => null),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("resolveTeammateConnectorAuthority", () => {
  it("lets a personal context read the owner's own account without a grant", async () => {
    const authority = await resolveTeammateConnectorAuthority({
      context: createContext({
        scope: { type: "personal", id: String(USER_ID) },
        connections: [connection({})],
      }),
      contextId: "ctx_1",
      userId: USER_ID,
      provider: "lastfm",
    });

    expect(authority.allowedOperations).toEqual([
      "get_recent_tracks",
      "get_top_artists",
      "get_top_tracks",
    ]);
    expect(authority.grantRevision).toBe(0);
    expect(authority.connectedAccountId).toBeUndefined();
  });

  it("carries the Composio account id for inherited reads", async () => {
    const authority = await resolveTeammateConnectorAuthority({
      context: createContext({
        scope: { type: "personal", id: String(USER_ID) },
        connections: [
          connection({
            provider: "gmail",
            kind: "recipe_connector_account",
            external_id: "ca_123",
          }),
        ],
      }),
      contextId: "ctx_1",
      userId: USER_ID,
      provider: "gmail",
    });

    expect(authority.connectedAccountId).toBe("ca_123");
    expect(authority.allowedOperations).toContain("GMAIL_FETCH_EMAILS");
    expect(authority.allowedOperations).not.toContain("GMAIL_SEND_EMAIL");
  });

  it("still requires a grant in a project context", async () => {
    await expect(
      resolveTeammateConnectorAuthority({
        context: createContext({
          scope: { type: "project", id: "proj_1" },
          connections: [connection({})],
        }),
        contextId: "ctx_1",
        userId: USER_ID,
        provider: "lastfm",
      }),
    ).rejects.toThrow("This teammate has no lastfm account grant");
  });
});
