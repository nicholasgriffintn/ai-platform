import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const repositoryMocks = vi.hoisted(() => ({
  getProviderApiKey: vi.fn(),
  hasProviderApiKey: vi.fn(),
}));

vi.mock("~/repositories/UserSettingsRepository", () => ({
  UserSettingsRepository: class {
    getProviderApiKey = repositoryMocks.getProviderApiKey;
    hasProviderApiKey = repositoryMocks.hasProviderApiKey;
  },
}));

import { resolveProviderApiKey } from "./apiKeys";

const env = {
  DB: {},
  TEST_PROVIDER_API_KEY: "platform-key",
} as unknown as IEnv;

describe("resolveProviderApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when configured BYOK credentials cannot be decrypted", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(true);
    repositoryMocks.getProviderApiKey.mockRejectedValue(
      new AssistantError("User settings not found", ErrorType.NOT_FOUND),
    );

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
      }),
    ).rejects.toMatchObject({
      type: ErrorType.NOT_FOUND,
    });
  });

  it("fails closed when configured BYOK credentials disappear during resolution", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(true);
    repositoryMocks.getProviderApiKey.mockResolvedValue(null);

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
      }),
    ).rejects.toMatchObject({
      type: ErrorType.CONFIGURATION_ERROR,
    });
  });

  it("uses the platform credential when the user has no BYOK credential", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(false);

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
      }),
    ).resolves.toBe("platform-key");

    expect(repositoryMocks.getProviderApiKey).not.toHaveBeenCalled();
  });

  it("does not fall back to the platform credential when BYOK authority was required", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(false);

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
        credentialAuthority: "byok",
      }),
    ).rejects.toMatchObject({
      type: ErrorType.AUTHORISATION_ERROR,
      statusCode: 403,
    });

    expect(repositoryMocks.getProviderApiKey).not.toHaveBeenCalled();
  });
});
