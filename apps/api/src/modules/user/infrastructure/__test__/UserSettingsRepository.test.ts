import { webcrypto } from "node:crypto";

import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { describe, expect, it, vi } from "vitest";

import type { IEnv } from "~/types";

import { UserSettingsRepository } from "../UserSettingsRepository";

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

describe("UserSettingsRepository", () => {
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
  });

  it("ignores empty and unsupported settings updates", async () => {
    const prepare = vi.fn();
    const repository = new UserSettingsRepository({ DB: { prepare } } as unknown as IEnv);

    await repository.updateUserSettings(42, {});
    await repository.updateUserSettings(42, { user_id: 7, private_key: "unsupported" });

    expect(prepare).not.toHaveBeenCalled();
  });
});
