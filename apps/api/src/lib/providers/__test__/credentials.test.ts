import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

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

import { resolveProviderApiKey } from "../credentials";

const env = {
  DB: {},
  TEST_PROVIDER_API_KEY: "platform-key",
} as unknown as IEnv;

describe("resolveProviderApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes repository failures through as the host's own errors", async () => {
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
    ).rejects.toMatchObject({ type: ErrorType.NOT_FOUND });
  });

  it("maps a missing stored key to a configuration error", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(true);
    repositoryMocks.getProviderApiKey.mockResolvedValue(null);

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
      }),
    ).rejects.toMatchObject({ type: ErrorType.CONFIGURATION_ERROR });
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
  });

  it("maps a required BYOK credential to a 403 authorisation error", async () => {
    repositoryMocks.hasProviderApiKey.mockResolvedValue(false);

    await expect(
      resolveProviderApiKey({
        env,
        providerName: "test-provider",
        envKeyName: "TEST_PROVIDER_API_KEY",
        userId: 42,
        credentialAuthority: "byok",
      }),
    ).rejects.toMatchObject({ type: ErrorType.AUTHORISATION_ERROR, statusCode: 403 });
  });
});
