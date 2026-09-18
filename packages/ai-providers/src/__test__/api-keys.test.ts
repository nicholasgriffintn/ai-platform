import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasUserProviderApiKey, resolveProviderApiKey, type ProviderKeyStore } from "../api-keys";
import { ProviderError } from "../errors";

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

  it("prefers the stored user key over the platform key", async () => {
    has.mockResolvedValue(true);
    get.mockResolvedValue("user-key");

    await expect(resolveProviderApiKey(options)).resolves.toBe("user-key");
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

  it("uses the platform key when the user has none", async () => {
    has.mockResolvedValue(false);

    await expect(resolveProviderApiKey(options)).resolves.toBe("platform-key");
    expect(get).not.toHaveBeenCalled();
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

  it("reports a missing platform key", async () => {
    has.mockResolvedValue(false);

    await expect(resolveProviderApiKey({ ...options, env: {} })).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(resolveProviderApiKey({ ...options, env: {} })).rejects.toMatchObject({
      code: "credential_missing",
    });
  });
});

describe("hasUserProviderApiKey", () => {
  it("is false without a user, store, or provider name", async () => {
    await expect(hasUserProviderApiKey({ providerName: "x", keyStore })).resolves.toBe(false);
    await expect(hasUserProviderApiKey({ userId: 1, providerName: "x" })).resolves.toBe(false);
    await expect(hasUserProviderApiKey({ userId: 1, providerName: " ", keyStore })).resolves.toBe(
      false,
    );
  });

  it("asks the store otherwise", async () => {
    has.mockResolvedValue(true);

    await expect(hasUserProviderApiKey({ userId: 1, providerName: "x", keyStore })).resolves.toBe(
      true,
    );
  });
});
