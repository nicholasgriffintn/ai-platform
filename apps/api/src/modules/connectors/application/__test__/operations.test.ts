import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRecipeConnectorAccessToken: vi.fn(),
  executeTflOperation: vi.fn(),
  listComposioConnectedAccounts: vi.fn(),
  createComposioToolSession: vi.fn(),
  executeComposioSessionTool: vi.fn(),
  searchComposioSessionTools: vi.fn(),
  deleteComposioToolSession: vi.fn(),
  discoverComposioRunTools: vi.fn(),
  executeComposioRunTool: vi.fn(),
  getSelectedRecipeConnectorAccountId: vi.fn(),
}));

vi.mock("../index", () => ({
  getRecipeConnectorAccessToken: mocks.getRecipeConnectorAccessToken,
}));

vi.mock("@ngriffin_uk/polychat-ai-integrations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@ngriffin_uk/polychat-ai-integrations")>()),
  executeTflOperation: mocks.executeTflOperation,
  listComposioConnectedAccounts: mocks.listComposioConnectedAccounts,
  createComposioToolSession: mocks.createComposioToolSession,
  executeComposioSessionTool: mocks.executeComposioSessionTool,
  searchComposioSessionTools: mocks.searchComposioSessionTools,
  deleteComposioToolSession: mocks.deleteComposioToolSession,
}));

vi.mock("../composio-run", () => ({
  discoverComposioRunTools: mocks.discoverComposioRunTools,
  executeComposioRunTool: mocks.executeComposioRunTool,
}));

vi.mock("../accounts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../accounts")>()),
  getSelectedRecipeConnectorAccountId: mocks.getSelectedRecipeConnectorAccountId,
}));

import { executeRecipeConnectorOperation } from "../operations";

const context = {
  env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
} as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

describe("recipe connector operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecipeConnectorAccessToken.mockResolvedValue({ accessToken: "token" });
    mocks.listComposioConnectedAccounts.mockResolvedValue([
      {
        id: "ca_gmail",
        authConfigId: "ac_uRCWNPtnTpEw",
        status: "ACTIVE",
        isDisabled: false,
      },
    ]);
    mocks.createComposioToolSession.mockResolvedValue("trs_connector");
    mocks.executeComposioSessionTool.mockResolvedValue({ messages: [] });
    mocks.discoverComposioRunTools.mockResolvedValue({ sessionId: "ccs_connector", tools: [] });
    mocks.executeComposioRunTool.mockResolvedValue({ messages: [] });
    mocks.deleteComposioToolSession.mockResolvedValue(undefined);
    mocks.getSelectedRecipeConnectorAccountId.mockResolvedValue(undefined);
  });

  it("rejects unsupported provider operations before reading OAuth tokens", async () => {
    await expect(
      executeRecipeConnectorOperation({
        context: {} as Parameters<typeof executeRecipeConnectorOperation>[0]["context"],
        userId: 42,
        request: {
          provider: "gmail",
          operation: "delete_message",
          params: { id: "message-1" },
        },
      }),
    ).rejects.toThrow("Unsupported recipe connector operation");

    expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    { status: "PENDING", isDisabled: false },
    { status: "ACTIVE", isDisabled: true },
  ])("does not execute with an unusable explicit account", async (account) => {
    mocks.listComposioConnectedAccounts.mockResolvedValue([{ id: "ca_gmail", ...account }]);

    await expect(
      executeRecipeConnectorOperation({
        context,
        userId: 42,
        request: { provider: "gmail", operation: "GMAIL_CREATE_EMAIL_DRAFT", params: {} },
      }),
    ).rejects.toMatchObject({ message: "Connector is not connected", statusCode: 403 });
    expect(mocks.executeComposioSessionTool).not.toHaveBeenCalled();
  });

  it("rejects public credential selection for private connector operations", async () => {
    await expect(
      executeRecipeConnectorOperation({
        context,
        userId: 42,
        request: {
          provider: "gmail",
          operation: "GMAIL_FETCH_EMAILS",
          params: {},
          credentialSource: "public",
        },
      }),
    ).rejects.toThrow("Public access is not available");
    expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
    expect(mocks.executeComposioRunTool).not.toHaveBeenCalled();
  });
});
