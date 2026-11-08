import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveProviderApiKey, type ProviderKeyStore } from "../api-keys";

const keyStore: ProviderKeyStore = {
  hasProviderApiKey: vi.fn(),
  getProviderApiKey: vi.fn(),
};

const has = vi.mocked(keyStore.hasProviderApiKey);
const get = vi.mocked(keyStore.getProviderApiKey);

const env = { TEST_PROVIDER_API_KEY: "platform-key" };

const options = {
  env,
  providerName: "test-provider",
  envKeyName: "TEST_PROVIDER_API_KEY",
  userId: 42,
  keyStore,
};

describe("resolveProviderApiKey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails closed when the stored key cannot be read", async () => {
    has.mockResolvedValue(true);
    get.mockRejectedValue(new Error("decrypt failed"));
    const logger = { error: vi.fn() };

    await expect(resolveProviderApiKey({ ...options, logger })).rejects.toThrow("decrypt failed");
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it("fails closed when the stored key disappears during resolution", async () => {
    has.mockResolvedValue(true);
    get.mockResolvedValue(null);

    await expect(resolveProviderApiKey(options)).rejects.toMatchObject({
      code: "credential_unavailable",
      providerName: "test-provider",
    });
  });

  it("refuses the platform key when BYOK authority was required", async () => {
    has.mockResolvedValue(false);

    await expect(
      resolveProviderApiKey({ ...options, credentialAuthority: "byok" }),
    ).rejects.toMatchObject({ code: "credential_required" });
    await expect(
      resolveProviderApiKey({ ...options, keyStore: undefined, credentialAuthority: "byok" }),
    ).rejects.toMatchObject({ code: "credential_required" });
    expect(get).not.toHaveBeenCalled();
  });
});
