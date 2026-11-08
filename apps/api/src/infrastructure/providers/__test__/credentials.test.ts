import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

const repositoryMocks = vi.hoisted(() => ({
  getProviderApiKey: vi.fn(),
  hasProviderApiKey: vi.fn(),
}));

vi.mock("~/modules/user/infrastructure/UserSettingsRepository", () => ({
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
