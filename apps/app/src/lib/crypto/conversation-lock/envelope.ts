import { randomBytes } from "@ngriffin_uk/auth-crypto";
import { decodeBase64Url, encodeBase64Url } from "@ngriffin_uk/auth-encoding";
import { CONVERSATION_LOCK_VERSION, type SealedEnvelope } from "@ngriffin_uk/polychat-schemas";

import { toArrayBuffer } from "../bytes";

const AES_GCM_IV_BYTES = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Envelopes are bound to where they live. Moving one between conversations, or replaying
 * it at a different position, fails the GCM tag rather than decrypting into the wrong thread.
 */
export function buildEnvelopeContext(parts: readonly string[]): Uint8Array {
  return encoder.encode(parts.join(" "));
}

export async function seal(
  key: CryptoKey,
  plaintext: Uint8Array,
  additionalData: Uint8Array,
): Promise<SealedEnvelope> {
  const iv = randomBytes(AES_GCM_IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(additionalData),
    },
    key,
    toArrayBuffer(plaintext),
  );

  return {
    v: CONVERSATION_LOCK_VERSION,
    iv: encodeBase64Url(iv, false),
    ct: encodeBase64Url(new Uint8Array(ciphertext), false),
  };
}

export async function open(
  key: CryptoKey,
  envelope: SealedEnvelope,
  additionalData: Uint8Array,
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: toArrayBuffer(decodeBase64Url(envelope.iv)),
      additionalData: toArrayBuffer(additionalData),
    },
    key,
    toArrayBuffer(decodeBase64Url(envelope.ct)),
  );

  return new Uint8Array(plaintext);
}

export async function sealJson(
  key: CryptoKey,
  value: unknown,
  additionalData: Uint8Array,
): Promise<SealedEnvelope> {
  return seal(key, encoder.encode(JSON.stringify(value)), additionalData);
}

export async function openJson<T>(
  key: CryptoKey,
  envelope: SealedEnvelope,
  additionalData: Uint8Array,
): Promise<T> {
  return JSON.parse(decoder.decode(await open(key, envelope, additionalData))) as T;
}
