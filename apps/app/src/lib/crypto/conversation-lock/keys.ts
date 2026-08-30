import { randomBytes } from "@ngriffin_uk/auth-crypto";
import {
  decodeBase32,
  decodeBase64Url,
  encodeBase32,
  encodeBase64Url,
} from "@ngriffin_uk/auth-encoding";
import {
  CONVERSATION_LOCK_PBKDF2_ITERATIONS,
  type SealedEnvelope,
} from "@ngriffin_uk/polychat-schemas";

import { toArrayBuffer } from "../bytes";
import { buildEnvelopeContext, open, seal } from "./envelope";

const CONVERSATION_KEY_BYTES = 32;
const SALT_BYTES = 16;
const RECOVERY_KEY_BYTES = 20;
const RECOVERY_GROUP_PATTERN = /.{1,5}/g;

async function importWrappingKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(secret), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * The conversation key is non-extractable, so an unlocked tab holds something it can
 * decrypt with but cannot read back out of memory and send anywhere.
 */
async function importConversationKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(raw), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}

export function createSalt(): string {
  return encodeBase64Url(randomBytes(SALT_BYTES), false);
}

export function createConversationKeyMaterial(): Uint8Array {
  return randomBytes(CONVERSATION_KEY_BYTES);
}

/**
 * Recovery keys are read off a screen and typed back in, so they are base32 in short
 * groups. Case and dashes are normalised away on the way back.
 */
export function createRecoveryKey(): string {
  const encoded = encodeBase32(randomBytes(RECOVERY_KEY_BYTES), false);

  return (encoded.match(RECOVERY_GROUP_PATTERN) ?? []).join("-");
}

export function normaliseRecoveryKey(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export async function deriveKeyFromPassword(
  password: string,
  salt: string,
  iterations = CONVERSATION_LOCK_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations,
      salt: toArrayBuffer(decodeBase64Url(salt)),
    },
    material,
    CONVERSATION_KEY_BYTES * 8,
  );

  return importWrappingKey(new Uint8Array(bits));
}

/** Recovery keys carry 160 bits, which is not a valid AES key length on its own. */
export async function deriveKeyFromRecoveryKey(recoveryKey: string): Promise<CryptoKey> {
  return deriveWrappingKeyFromSecret(
    decodeBase32(normaliseRecoveryKey(recoveryKey)),
    "polychat.conversation-lock.recovery",
  );
}

async function deriveWrappingKeyFromSecret(secret: Uint8Array, info: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", toArrayBuffer(secret), "HKDF", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    material,
    CONVERSATION_KEY_BYTES * 8,
  );

  return importWrappingKey(new Uint8Array(bits));
}

/**
 * A passkey's PRF output is already a high-entropy secret, so it needs domain
 * separation and stretching to the AES key length rather than a slow KDF.
 */
export async function deriveKeyFromPrfOutput(output: Uint8Array): Promise<CryptoKey> {
  return deriveWrappingKeyFromSecret(output, "polychat.conversation-lock.passkey");
}

function wrapContext(conversationId: string): Uint8Array {
  return buildEnvelopeContext(["conversation-key", conversationId]);
}

export async function wrapConversationKey(
  wrappingKey: CryptoKey,
  conversationId: string,
  conversationKeyMaterial: Uint8Array,
): Promise<SealedEnvelope> {
  return seal(wrappingKey, conversationKeyMaterial, wrapContext(conversationId));
}

export async function unwrapConversationKeyMaterial(
  wrappingKey: CryptoKey,
  conversationId: string,
  wrapped: SealedEnvelope,
): Promise<Uint8Array> {
  return open(wrappingKey, wrapped, wrapContext(conversationId));
}

export async function toConversationKey(material: Uint8Array): Promise<CryptoKey> {
  return importConversationKey(material);
}
