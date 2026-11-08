import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectorProviderConfig } from "../../providers.js";
import {
  createComposioConnectLink,
  createComposioToolSession,
  executeComposioSessionTool,
} from "../client";
import type { ComposioEnvironment } from "../request.js";

function createEnv(): ComposioEnvironment {
  return Object.assign(Object.create(null), {
    COMPOSIO_API_KEY: "composio-secret",
    COMPOSIO_USER_NAMESPACE: "test",
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function gmailProvider(authConfigId = "ac_gmail"): ConnectorProviderConfig {
  return {
    id: "gmail",
    name: "Gmail",
    description: "Test Gmail provider",
    categories: [],
    setupUrl: "/profile",
    operations: [
      {
        id: "GMAIL_FETCH_EMAILS",
        access: "read",
        authConfigIds: [authConfigId],
        inputSchema: { type: "object", properties: {} },
      },
    ],
    auth: {
      authType: "composio",
      toolkitSlug: "gmail",
      toolkitVersion: "20260721_00",
      authConfigs: [{ id: authConfigId, name: "gmail", authScheme: "OAUTH2", isManaged: true }],
      scopes: [],
    },
  };
}

describe("Composio REST client", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a connect-link redirect outside the documented Composio origin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          id: "ac_gmail",
          name: "Polychat Gmail",
          toolkit: { slug: "gmail" },
          auth_scheme: "OAUTH2",
          is_composio_managed: true,
          status: "ENABLED",
          restrict_to_following_tools: [],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ session_id: "trs_gmail" }, 201))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            redirect_url: "https://attacker.example/link/token",
            connected_account_id: "ca_gmail",
          },
          201,
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createComposioConnectLink({
        env: createEnv(),
        userId: 42,
        provider: gmailProvider(),
        authConfigId: "ac_gmail",
        callbackUrl: "https://api.polychat.test/connectors/composio_callback",
      }),
    ).rejects.toMatchObject({ message: "Composio link response is invalid", statusCode: 502 });
  });

  it("verifies exact session ownership, auth config, account, and scope before execution", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url.endsWith("/trs_gmail") && init?.method === "GET") {
        return jsonResponse({
          config: {
            user_id: "polychat:test:user:42",
            toolkits: { enabled: ["gmail"] },
            auth_configs: { gmail: "ac_gmail" },
            connected_accounts: { gmail: ["ca_gmail"] },
            tools: { gmail: { enabled: ["GMAIL_FETCH_EMAILS"] } },
          },
        });
      }

      if (url.endsWith("/trs_gmail/execute")) {
        return jsonResponse({ data: { messages: [] }, error: null, log_id: "log_1" });
      }

      return jsonResponse({});
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      executeComposioSessionTool({
        env: createEnv(),
        userId: 42,
        sessionId: "trs_gmail",
        provider: gmailProvider(),
        toolSlug: "GMAIL_FETCH_EMAILS",
        authConfigId: "ac_gmail",
        connectedAccountId: "ca_gmail",
        arguments: { query: "invoice" },
      }),
    ).resolves.toEqual({ data: { messages: [] }, logId: "log_1" });
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces scoped API-key permission errors without leaking the upstream payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          {
            error: {
              slug: "APIKey_InsufficientPermissions",
              message: 'This route requires "sessions" write access, but the key has read access.',
              request_id: "request-safe",
            },
          },
          403,
        ),
      ),
    );

    await expect(
      createComposioToolSession({
        env: createEnv(),
        userId: 42,
        provider: gmailProvider(),
        connectedAccount: {
          id: "ca_gmail",
          userId: "polychat:test:user:42",
          toolkitSlug: "gmail",
          authConfigId: "ac_gmail",
          status: "ACTIVE",
          createdAt: "now",
          updatedAt: "now",
          isDisabled: false,
        },
        allowedToolSlugs: ["GMAIL_FETCH_EMAILS"],
      }),
    ).rejects.toMatchObject({
      message: "Composio API key needs write access for sessions",
      statusCode: 403,
      context: { requestId: "request-safe" },
    });
  });
});
