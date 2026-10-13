import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listComposioConnectedAccounts: vi.fn(),
  findComposioAccountProvider: vi.fn(),
}));

vi.mock("@ngriffin_uk/polychat-ai-integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-integrations")>()),
  listComposioConnectedAccounts: mocks.listComposioConnectedAccounts,
}));

vi.mock("../connector-adapters", () => ({
  findComposioAccountProvider: mocks.findComposioAccountProvider,
}));

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

import { listMirroredComposioAccounts } from "../composio-account-mirror";

const account = {
  id: "ca_1",
  userId: "polychat:test:user:7",
  toolkitSlug: "gmail",
  authConfigId: "ac_1",
  status: "ACTIVE",
  isDisabled: false,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

function reference(
  metadata: Record<string, unknown>,
  externalId = "ca_1",
): ProviderConnectionRecord {
  return {
    id: `ref_${externalId}`,
    user_id: 7,
    provider: "gmail",
    kind: "recipe_connector_account",
    external_id: externalId,
    status: "connected",
    encrypted_data: "{}",
    metadata: JSON.stringify(metadata),
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

function syncMarker(state: Record<string, string>): ProviderConnectionRecord {
  return {
    ...reference(state, ""),
    provider: "composio",
    kind: "recipe_connector_account_sync",
  };
}

const mirrored = reference({
  composioUserId: account.userId,
  toolkitSlug: account.toolkitSlug,
  authConfigId: account.authConfigId,
  status: account.status,
  isDisabled: account.isDisabled,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

function context() {
  const upsertConnection = vi.fn(async (input) => input);
  const waitUntil = vi.fn();

  return {
    upsertConnection,
    waitUntil,
    context: {
      env: {},
      waitUntil,
      repositories: { providerConnections: { upsertConnection } },
    } as unknown as ServiceContext,
  };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("listMirroredComposioAccounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findComposioAccountProvider.mockReturnValue({ id: "gmail" });
    mocks.listComposioConnectedAccounts.mockResolvedValue([account]);
  });

  it("serves a fresh mirror without calling Composio", async () => {
    const { context: serviceContext, waitUntil } = context();

    const accounts = await listMirroredComposioAccounts(serviceContext, 7, [
      mirrored,
      syncMarker({ syncedAt: minutesAgo(1) }),
    ]);

    expect(accounts).toEqual([account]);
    expect(mocks.listComposioConnectedAccounts).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("refreshes a stale mirror after responding from it", async () => {
    const { context: serviceContext, waitUntil } = context();

    const accounts = await listMirroredComposioAccounts(serviceContext, 7, [
      mirrored,
      syncMarker({ syncedAt: minutesAgo(30) }),
    ]);

    expect(accounts).toEqual([account]);
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it("reads Composio live before the first sync and while a connection is in progress", async () => {
    for (const connections of [
      [],
      [mirrored, syncMarker({ syncedAt: minutesAgo(1), liveUntil: minutesAgo(-30) })],
    ]) {
      mocks.listComposioConnectedAccounts.mockClear();
      const { context: serviceContext, upsertConnection } = context();

      await expect(listMirroredComposioAccounts(serviceContext, 7, connections)).resolves.toEqual([
        account,
      ]);
      expect(mocks.listComposioConnectedAccounts).toHaveBeenCalledOnce();
      expect(upsertConnection).toHaveBeenLastCalledWith(
        expect.objectContaining({ kind: "recipe_connector_account_sync" }),
      );
    }
  });

  it("marks accounts Composio no longer lists as revoked instead of deleting them", async () => {
    mocks.listComposioConnectedAccounts.mockResolvedValue([]);
    const { context: serviceContext, upsertConnection } = context();

    await listMirroredComposioAccounts(serviceContext, 7, [mirrored]);

    expect(upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        externalId: "ca_1",
        status: "revoked",
        metadata: expect.objectContaining({ status: "REVOKED" }),
      }),
    );
  });
});
