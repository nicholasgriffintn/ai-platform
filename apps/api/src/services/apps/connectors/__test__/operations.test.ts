import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getRecipeConnectorAccessToken: vi.fn(),
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

vi.mock("~/lib/providers/capabilities/connectors/composio/client", () => ({
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

vi.mock("../accounts", () => ({
  getSelectedRecipeConnectorAccountId: mocks.getSelectedRecipeConnectorAccountId,
}));

import { executeRecipeConnectorOperation } from "../operations";

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

  it("executes only the registry-mapped Composio tool on the explicit user account", async () => {
    const context = {
      env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
    } as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

    await expect(
      executeRecipeConnectorOperation({
        context,
        userId: 42,
        request: {
          provider: "gmail",
          operation: "GMAIL_FETCH_EMAILS",
          params: { query: "from:alerts@example.com", max_results: 5 },
        },
      }),
    ).resolves.toEqual({ messages: [] });
    expect(mocks.listComposioConnectedAccounts).toHaveBeenCalledWith({
      env: context.env,
      userId: 42,
      toolkitSlugs: ["gmail"],
      authConfigIds: ["ac_uRCWNPtnTpEw"],
    });
    expect(mocks.executeComposioRunTool).toHaveBeenCalledWith({
      context,
      userId: 42,
      provider: expect.objectContaining({ id: "gmail" }),
      connectedAccount: expect.objectContaining({ id: "ca_gmail" }),
      operationId: "GMAIL_FETCH_EMAILS",
      arguments: {
        query: "from:alerts@example.com",
        max_results: 5,
      },
      scope: expect.any(Object),
    });
    expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
  });

  it("passes Outlook arguments using the generated Composio schema", async () => {
    const context = {
      env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
    } as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

    await executeRecipeConnectorOperation({
      context,
      userId: 42,
      request: {
        provider: "outlook",
        operation: "OUTLOOK_CALENDAR_CREATE_EVENT",
        params: {
          subject: "Planning",
          start_datetime: "2026-08-13T09:00:00.000Z",
          end_datetime: "2026-08-13T10:00:00.000Z",
          time_zone: "Europe/London",
        },
      },
    });

    expect(mocks.executeComposioRunTool).toHaveBeenCalledWith(
      expect.objectContaining({
        operationId: "OUTLOOK_CALENDAR_CREATE_EVENT",
        arguments: expect.objectContaining({ time_zone: "Europe/London" }),
      }),
    );
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

  it("rejects non-object operation params before reading OAuth tokens", async () => {
    await expect(
      executeRecipeConnectorOperation({
        context: {} as Parameters<typeof executeRecipeConnectorOperation>[0]["context"],
        userId: 42,
        request: {
          provider: "gmail",
          operation: "GMAIL_FETCH_EMAILS",
          params: ["not", "an", "object"] as unknown as Record<string, unknown>,
        },
      }),
    ).rejects.toThrow("Connector operation params must be an object");

    expect(mocks.getRecipeConnectorAccessToken).not.toHaveBeenCalled();
  });

  it.each([
    { status: "PENDING", isDisabled: false },
    { status: "ACTIVE", isDisabled: true },
  ])("does not execute with an unusable explicit account", async (account) => {
    mocks.listComposioConnectedAccounts.mockResolvedValue([{ id: "ca_gmail", ...account }]);
    const context = {
      env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
    } as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

    await expect(
      executeRecipeConnectorOperation({
        context,
        userId: 42,
        request: { provider: "gmail", operation: "GMAIL_CREATE_EMAIL_DRAFT", params: {} },
      }),
    ).rejects.toMatchObject({ message: "Connector is not connected", statusCode: 403 });
    expect(mocks.executeComposioSessionTool).not.toHaveBeenCalled();
  });

  it("uses the most recently connected active account", async () => {
    mocks.listComposioConnectedAccounts.mockResolvedValue([
      {
        id: "ca_newer",
        status: "ACTIVE",
        isDisabled: false,
        createdAt: "2026-08-12T12:00:00.000Z",
      },
      {
        id: "ca_older",
        status: "ACTIVE",
        isDisabled: false,
        createdAt: "2026-08-12T10:00:00.000Z",
      },
    ]);
    const context = {
      env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
    } as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

    await executeRecipeConnectorOperation({
      context,
      userId: 42,
      request: { provider: "gmail", operation: "GMAIL_FETCH_EMAILS", params: {} },
    });

    expect(mocks.executeComposioRunTool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedAccount: expect.objectContaining({ id: "ca_newer" }),
      }),
    );
    expect(mocks.executeComposioRunTool).toHaveBeenCalledOnce();
  });

  it("prefers the selected active account over the most recently connected account", async () => {
    mocks.listComposioConnectedAccounts.mockResolvedValue([
      {
        id: "ca_newer",
        authConfigId: "ac_uRCWNPtnTpEw",
        status: "ACTIVE",
        isDisabled: false,
        createdAt: "2026-08-12T12:00:00.000Z",
      },
      {
        id: "ca_selected",
        authConfigId: "ac_uRCWNPtnTpEw",
        status: "ACTIVE",
        isDisabled: false,
        createdAt: "2026-08-12T10:00:00.000Z",
      },
    ]);
    mocks.getSelectedRecipeConnectorAccountId.mockResolvedValue("ca_selected");
    const context = {
      env: { COMPOSIO_API_KEY: "secret", COMPOSIO_USER_NAMESPACE: "test" },
    } as Parameters<typeof executeRecipeConnectorOperation>[0]["context"];

    await executeRecipeConnectorOperation({
      context,
      userId: 42,
      request: { provider: "gmail", operation: "GMAIL_FETCH_EMAILS", params: {} },
    });

    expect(mocks.executeComposioRunTool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectedAccount: expect.objectContaining({ id: "ca_selected" }),
      }),
    );
  });
});
