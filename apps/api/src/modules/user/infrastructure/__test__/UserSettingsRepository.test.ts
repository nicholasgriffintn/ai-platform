import { webcrypto } from "node:crypto";

import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { UserSettingsRepository } from "../UserSettingsRepository";

const CONFIGURABLE_PROVIDER_IDS = ["openai", "anthropic", "groq"];

const OVER_RSA_OAEP_LIMIT_PROVIDER_KEY = `synthetic-provider-key:${"a".repeat(320)}`;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

async function encryptPrivateKey(
  privateKey: JsonWebKey,
  rawServerKey: Uint8Array,
): Promise<string> {
  const key = await webcrypto.subtle.importKey(
    "raw",
    toArrayBuffer(rawServerKey),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const data = await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(JSON.stringify(privateKey)),
  );

  return JSON.stringify({
    iv: bufferToBase64(iv),
    data: bufferToBase64(new Uint8Array(data)),
  });
}

function createProvisioningRepository(existingProviders: string[]) {
  const all = vi.fn().mockResolvedValue({
    results: existingProviders.map((provider_id) => ({ provider_id })),
  });
  const first = vi.fn().mockResolvedValue(null);
  const run = vi.fn().mockResolvedValue({ success: true });
  const bind = vi.fn().mockReturnValue({ all, first, run });
  const prepare = vi.fn().mockReturnValue({ bind, all, first, run });
  const batch = vi.fn().mockResolvedValue([]);

  const repository = new UserSettingsRepository({
    DB: { batch, prepare },
  } as unknown as IEnv);

  return { batch, prepare, repository };
}

describe("UserSettingsRepository", () => {
  it("provisions provider settings with one read and one batched write", async () => {
    const { batch, prepare, repository } = createProvisioningRepository([]);

    await repository.createUserProviderSettings(1, CONFIGURABLE_PROVIDER_IDS);

    const selects = prepare.mock.calls.filter(([query]) => (query as string).startsWith("SELECT"));

    expect(selects).toHaveLength(1);
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0][0].length).toBeGreaterThan(1);
  });

  it("skips providers the user already has", async () => {
    const { batch, repository } = createProvisioningRepository([]);

    await repository.createUserProviderSettings(1, CONFIGURABLE_PROVIDER_IDS);

    const provisioned = batch.mock.calls[0][0].length;

    const second = createProvisioningRepository(["openai"]);

    await second.repository.createUserProviderSettings(1, CONFIGURABLE_PROVIDER_IDS);

    expect(second.batch.mock.calls[0][0].length).toBe(provisioned - 1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stores and retrieves provider credentials longer than the RSA-OAEP payload limit", async () => {
    vi.stubGlobal("crypto", webcrypto);

    const serverKey = webcrypto.getRandomValues(new Uint8Array(32));
    const keyPair = await webcrypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 3072,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
    const publicKey = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);
    const encryptedPrivateKey = await encryptPrivateKey(privateKey, serverKey);
    let storedApiKey = "";

    const repo = new UserSettingsRepository({
      DB: {} as any,
      PRIVATE_KEY: bufferToBase64(serverKey),
    } as IEnv);

    vi.spyOn(repo as any, "executeRun").mockImplementation(async (_query, values) => {
      storedApiKey = values[0];

      return { success: true } as any;
    });

    vi.spyOn(repo as any, "runQuery")
      .mockResolvedValueOnce({ id: "provider-settings-row-id" })
      .mockResolvedValueOnce({ public_key: JSON.stringify(publicKey) });

    await repo.storeProviderApiKey(42, "cortecs", OVER_RSA_OAEP_LIMIT_PROVIDER_KEY);

    vi.mocked((repo as any).runQuery).mockReset();
    vi.spyOn(repo as any, "runQuery")
      .mockResolvedValueOnce({ private_key: encryptedPrivateKey })
      .mockResolvedValueOnce({ api_key: storedApiKey });

    await expect(repo.getProviderApiKey(42, "cortecs")).resolves.toBe(
      OVER_RSA_OAEP_LIMIT_PROVIDER_KEY,
    );

    vi.mocked((repo as any).runQuery).mockReset();
    const rowScopedRunQuerySpy = vi
      .spyOn(repo as any, "runQuery")
      .mockResolvedValueOnce({ private_key: encryptedPrivateKey })
      .mockResolvedValueOnce({ api_key: storedApiKey });

    await expect(
      repo.getProviderApiKeyForSettings({
        userId: 42,
        providerId: "cortecs",
        providerSettingsId: "provider-settings-row-id",
      }),
    ).resolves.toBe(OVER_RSA_OAEP_LIMIT_PROVIDER_KEY);
    expect(rowScopedRunQuerySpy.mock.calls[1]?.[0]).toContain("id = ?");
    expect(rowScopedRunQuerySpy.mock.calls[1]?.[0]).toContain("provider_id = ?");
    expect(rowScopedRunQuerySpy.mock.calls[1]?.[1]).toEqual([
      42,
      "provider-settings-row-id",
      "cortecs",
    ]);
  });

  it("clears provider credentials and disables the provider by provider_id", async () => {
    const repo = new UserSettingsRepository({ DB: {} as any } as IEnv);
    const executeRunSpy = vi
      .spyOn(repo as any, "executeRun")
      .mockResolvedValue({ success: true } as any);

    await repo.deleteProviderApiKey(42, "cartesia");

    expect(executeRunSpy).toHaveBeenCalledTimes(1);
    expect(executeRunSpy.mock.calls[0]?.[0]).toContain("api_key = ?");
    expect(executeRunSpy.mock.calls[0]?.[0]).toContain("enabled = ?");
    expect(executeRunSpy.mock.calls[0]?.[0]).toContain("provider_id = ?");
    expect(executeRunSpy.mock.calls[0]?.[1]).toEqual([null, 0, 42, "cartesia"]);
  });

  it("does not broaden provider API key lookups for blank provider IDs", async () => {
    const repo = new UserSettingsRepository({ DB: {} as any } as IEnv);
    const runQuerySpy = vi.spyOn(repo as any, "runQuery");

    const result = await repo.hasProviderApiKey(42, " ");

    expect(result).toBe(false);
    expect(runQuerySpy).not.toHaveBeenCalled();
  });

  it("allows explicit clearing and false values without updating omitted fields", async () => {
    const { prepare, repository } = createProvisioningRepository([]);

    await repository.updateUserSettings(42, {
      nickname: null,
      preferences: "",
      tracking_enabled: false,
      search_provider: undefined,
    });

    expect(prepare).toHaveBeenCalledExactlyOnceWith(
      "UPDATE user_settings SET nickname = ?, preferences = ?, tracking_enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
    );
    expect(prepare.mock.results[0].value.bind).toHaveBeenCalledWith(null, "", 0, 42);
  });

  it("ignores empty and unsupported settings updates", async () => {
    const { prepare, repository } = createProvisioningRepository([]);

    await repository.updateUserSettings(42, {});
    await repository.updateUserSettings(42, { user_id: 7, private_key: "unsupported" });

    expect(prepare).not.toHaveBeenCalled();
  });
});
