import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import type { ProviderConnectionRecord } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";

import { encryptGitHubConnectionPayload } from "../connection-crypto";
import { getGitHubAppConnectionForUserInstallation } from "../connections";

const JWT_SECRET = "jwt-secret";
const USER_ID = 42;

async function createEncryptedRecord(params: {
  recordId: string;
  installationId: number;
  repositories?: string[];
}): Promise<ProviderConnectionRecord> {
  const encrypted = await encryptGitHubConnectionPayload({
    jwtSecret: JWT_SECRET,
    userId: USER_ID,
    payload: {
      app_id: "123456",
      private_key: "line1\\nline2",
      installation_id: params.installationId,
      repositories: params.repositories,
    },
  });

  return {
    id: params.recordId,
    user_id: USER_ID,
    provider: "github",
    kind: "github_app",
    external_id: String(params.installationId),
    status: "connected",
    encrypted_data: JSON.stringify({ encrypted }),
    metadata: "{}",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("github connections", () => {
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
      repositories: fakeRepositories([[ProviderConnectionRepository, { getConnection }]]),
    } as unknown as ServiceContext;

    await expect(
      getGitHubAppConnectionForUserInstallation(context, USER_ID, 8001, "owner/forged"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects every repository when the installation allowlist is explicitly empty", async () => {
    const getConnection = vi.fn().mockResolvedValue(
      await createEncryptedRecord({
        recordId: "record-empty-installation",
        installationId: 8001,
        repositories: [],
      }),
    );
    const context = {
      env: { JWT_SECRET },
      repositories: fakeRepositories([[ProviderConnectionRepository, { getConnection }]]),
    } as unknown as ServiceContext;

    await expect(
      getGitHubAppConnectionForUserInstallation(context, USER_ID, 8001, "owner/repo"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
