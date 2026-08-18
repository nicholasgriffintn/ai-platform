import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getGitHubAppInstallationToken } from "~/lib/github";
import { githubApiRequest } from "~/lib/github/api-client";
import type { ProviderConnectionRecord } from "~/repositories/ProviderConnectionRepository";
import { ErrorType } from "~/utils/errors";

import { encryptGitHubConnectionPayload } from "../connection-crypto";
import {
  getGitHubAppConnectionForInstallation,
  getGitHubAppConnectionForUserInstallation,
  getGitHubAppConnectionForUserRepo,
  listGitHubAppConnectionsForUser,
  listGitHubInstallationRepositoriesForUser,
} from "../connections";

vi.mock("~/lib/github", () => ({
  getGitHubAppInstallationToken: vi.fn(),
}));

vi.mock("~/lib/github/api-client", () => ({
  githubApiRequest: vi.fn(),
}));

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;

async function createEncryptedRecord(params: {
  recordId: string;
  installationId: number;
  itemId?: string;
  repositories?: string[];
  webhookSecret?: string;
  jwtSecret?: string;
}): Promise<ProviderConnectionRecord> {
  const encrypted = await encryptGitHubConnectionPayload({
    jwtSecret: params.jwtSecret ?? JWT_SECRET,
    userId: USER_ID,
    payload: {
      app_id: "123456",
      private_key: "line1\\nline2",
      installation_id: params.installationId,
      webhook_secret: params.webhookSecret,
      repositories: params.repositories,
    },
  });

  return {
    id: params.recordId,
    user_id: USER_ID,
    provider: "github",
    kind: "github_app",
    external_id: params.itemId ?? String(params.installationId),
    status: "connected",
    encrypted_data: JSON.stringify({ encrypted }),
    metadata: "{}",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("github connections", () => {
  it("returns the matching user connection for a repository", async () => {
    const listConnections = vi.fn().mockResolvedValue([
      await createEncryptedRecord({
        recordId: "record-1",
        installationId: 1001,
        repositories: ["owner/other"],
      }),
      await createEncryptedRecord({
        recordId: "record-2",
        installationId: 1002,
        repositories: ["owner/repo"],
      }),
    ]);

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          listConnections,
        },
      },
    } as unknown as ServiceContext;

    const connection = await getGitHubAppConnectionForUserRepo(context, USER_ID, "owner/repo");

    expect(listConnections).toHaveBeenCalledWith(USER_ID, "github");
    expect(connection).toMatchObject({
      appId: "123456",
      privateKey: "line1\nline2",
      installationId: 1002,
    });
  });

  it("returns the connection by installation id", async () => {
    const getConnectionByExternalId = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-installation",
        installationId: 3001,
        webhookSecret: "webhook-secret",
      }),
    );

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          getConnectionByExternalId,
        },
      },
    } as unknown as ServiceContext;

    const connection = await getGitHubAppConnectionForInstallation(context, 3001);

    expect(getConnectionByExternalId).toHaveBeenCalledWith("github", "github_app", "3001");
    expect(connection).toMatchObject({
      appId: "123456",
      installationId: 3001,
      webhookSecret: "webhook-secret",
    });
  });

  it("returns the user-scoped connection by installation id", async () => {
    const getConnection = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-installation-user",
        installationId: 8001,
      }),
    );

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          getConnection,
        },
      },
    } as unknown as ServiceContext;

    const connection = await getGitHubAppConnectionForUserInstallation(context, USER_ID, 8001);

    expect(getConnection).toHaveBeenCalledWith(USER_ID, "github", "github_app", "8001");
    expect(connection).toMatchObject({
      appId: "123456",
      installationId: 8001,
    });
  });

  it("rejects a repository outside the installation allowlist", async () => {
    const getConnection = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-installation-user",
        installationId: 8001,
        repositories: ["owner/allowed"],
      }),
    );
    const context = {
      env: { JWT_SECRET },
      repositories: { providerConnections: { getConnection } },
    } as unknown as ServiceContext;

    await expect(
      getGitHubAppConnectionForUserInstallation(context, USER_ID, 8001, "owner/forged"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("lists user connections in updated order", async () => {
    const listConnections = vi.fn().mockResolvedValue([
      {
        ...(await createEncryptedRecord({
          recordId: "record-old",
          installationId: 9101,
          repositories: ["owner/old"],
        })),
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        ...(await createEncryptedRecord({
          recordId: "record-new",
          installationId: 9102,
          repositories: ["owner/new"],
          webhookSecret: "secret",
        })),
        updated_at: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          listConnections,
        },
      },
    } as unknown as ServiceContext;

    const summaries = await listGitHubAppConnectionsForUser(context, USER_ID);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      installationId: 9102,
      repositories: ["owner/new"],
      hasWebhookSecret: true,
    });
    expect(summaries[1]).toMatchObject({
      installationId: 9101,
      repositories: ["owner/old"],
      hasWebhookSecret: false,
    });
  });

  it("lists repositories available to a user installation", async () => {
    const getConnection = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-installation-user",
        installationId: 8002,
      }),
    );

    vi.mocked(getGitHubAppInstallationToken).mockResolvedValue("installation-token");
    vi.mocked(githubApiRequest)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repositories: [{ full_name: "Owner/Repo" }, { full_name: "owner/Second" }],
          }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            repositories: [],
          }),
        ),
      );

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          getConnection,
        },
      },
    } as unknown as ServiceContext;

    const repositories = await listGitHubInstallationRepositoriesForUser(context, USER_ID, 8002);

    expect(getGitHubAppInstallationToken).toHaveBeenCalledWith({
      appId: "123456",
      privateKey: "line1\nline2",
      installationId: 8002,
    });
    expect(githubApiRequest).toHaveBeenCalledWith({
      url: "https://api.github.com/installation/repositories?per_page=100&page=1",
      method: "GET",
      bearerToken: "installation-token",
    });
    expect(repositories).toEqual(["owner/repo", "owner/second"]);
  });

  it("throws a reconnect error when a stored connection cannot be decrypted", async () => {
    const listConnections = vi.fn().mockResolvedValue([
      await createEncryptedRecord({
        recordId: "record-old-secret",
        installationId: 9201,
        jwtSecret: "rotated-jwt-secret",
      }),
    ]);

    const context = {
      env: { JWT_SECRET },
      repositories: {
        providerConnections: {
          listConnections,
        },
      },
    } as unknown as ServiceContext;

    await expect(listGitHubAppConnectionsForUser(context, USER_ID)).rejects.toMatchObject({
      message:
        "GitHub App connection could not be decrypted. Reconnect the GitHub App installation.",
      type: ErrorType.CONFLICT_ERROR,
      statusCode: 409,
    });
  });

  it("rejects when JWT secret is not configured", async () => {
    const getConnectionByExternalId = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-installation",
        installationId: 3001,
      }),
    );

    const context = {
      env: {},
      repositories: {
        providerConnections: {
          getConnectionByExternalId,
        },
      },
    } as unknown as ServiceContext;

    await expect(getGitHubAppConnectionForInstallation(context, 3001)).rejects.toThrow(
      "JWT secret not configured",
    );
  });
});
