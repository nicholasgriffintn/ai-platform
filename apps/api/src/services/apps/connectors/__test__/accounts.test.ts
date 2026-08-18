import { beforeEach, describe, expect, it, vi } from "vitest";

const listAccountsMock = vi.hoisted(() => vi.fn());

vi.mock("~/lib/providers/capabilities/connectors/composio/client", () => ({
  listComposioConnectedAccounts: listAccountsMock,
}));

import {
  getSelectedRecipeConnectorAccountId,
  listRecipeConnectorAccounts,
  updateRecipeConnectorAccount,
} from "../accounts";

const account = {
  id: "ca_1",
  userId: "polychat:test:user:42",
  toolkitSlug: "gmail",
  authConfigId: "ac_uRCWNPtnTpEw",
  status: "ACTIVE",
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T11:00:00.000Z",
  isDisabled: false,
};

function createContext(records: unknown[] = []) {
  const providerConnections = {
    listConnections: vi.fn().mockResolvedValue(records),
    getConnection: vi.fn().mockResolvedValue(records[0] ?? null),
    upsertConnection: vi.fn().mockResolvedValue({}),
    deleteConnection: vi.fn().mockResolvedValue(undefined),
  };
  const context = {
    env: {},
    repositories: { providerConnections },
  } as never;

  return { context, providerConnections };
}

describe("connector accounts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listAccountsMock.mockResolvedValue([account]);
  });

  it("combines Composio state with user-owned aliases and selection", async () => {
    const { context } = createContext([
      {
        kind: "recipe_connector_account_alias",
        external_id: "ca_1",
        metadata: JSON.stringify({ alias: "Work inbox" }),
      },
      {
        kind: "recipe_connector_account_selection",
        external_id: "",
        metadata: JSON.stringify({ accountId: "ca_1" }),
      },
    ]);

    await expect(
      listRecipeConnectorAccounts({ context, userId: 42, providerId: "gmail" }),
    ).resolves.toEqual({
      accounts: [
        expect.objectContaining({
          id: "ca_1",
          alias: "Work inbox",
          isSelected: true,
        }),
      ],
    });
  });

  it("persists only an account already scoped to the authenticated Composio user", async () => {
    const { context, providerConnections } = createContext();

    const updated = await updateRecipeConnectorAccount({
      context,
      userId: 42,
      providerId: "gmail",
      input: { accountId: "ca_1", alias: "Finance", selected: true },
    });

    expect(updated.id).toBe("ca_1");
    expect(providerConnections.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        provider: "gmail",
        externalId: "ca_1",
        metadata: { alias: "Finance" },
      }),
    );
    expect(providerConnections.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        provider: "gmail",
        metadata: { accountId: "ca_1" },
      }),
    );
  });

  it("returns the persisted selection without querying Composio", async () => {
    const { context } = createContext([{ metadata: JSON.stringify({ accountId: "ca_selected" }) }]);

    await expect(
      getSelectedRecipeConnectorAccountId({ context, userId: 42, providerId: "gmail" }),
    ).resolves.toBe("ca_selected");
    expect(listAccountsMock).not.toHaveBeenCalled();
  });
});
