import { bufferToBase64 } from "@ngriffin_uk/polychat-utility-server/base64";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { safeParseJson } from "@ngriffin_uk/polychat-utility-server/json";
import { decodeBase64 } from "hono/utils/encode";

import type { IEnv } from "~/types";

type SecretEnv = Pick<IEnv, "PRIVATE_KEY">;

async function encryptionKey(env: SecretEnv): Promise<CryptoKey> {
  if (!env.PRIVATE_KEY) {
    throw new AssistantError("Server key not configured", ErrorType.CONFIGURATION_ERROR);
  }

  return crypto.subtle.importKey("raw", decodeBase64(env.PRIVATE_KEY), { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function sealSecret(env: SecretEnv, value: string): Promise<string> {
  const key = await encryptionKey(env);

  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(value),
    );

    return JSON.stringify({
      iv: bufferToBase64(iv),
      data: bufferToBase64(new Uint8Array(encrypted)),
    });
  } catch {
    throw new AssistantError("Failed to encrypt secret", ErrorType.UNKNOWN_ERROR);
  }
}

export async function openSecret(env: SecretEnv, envelope: string): Promise<string> {
  const key = await encryptionKey(env);

  try {
    const parsed = safeParseJson<{ iv?: string; data?: string }>(envelope);

    if (!parsed?.iv || !parsed.data) {
      throw new Error("Invalid secret envelope");
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: decodeBase64(parsed.iv) },
      key,
      decodeBase64(parsed.data),
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    throw new AssistantError("Failed to decrypt secret", ErrorType.UNKNOWN_ERROR);
  }
}
