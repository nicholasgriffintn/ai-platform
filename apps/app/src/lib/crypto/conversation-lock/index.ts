import {
  CONVERSATION_LOCK_PBKDF2_ITERATIONS,
  CONVERSATION_LOCK_VERSION,
  type ConversationLock,
  type ConversationLockKey,
  type ConversationLockKeyInput,
  type LockedMessage,
  type LockedMessageInput,
  type SealedEnvelope,
} from "@ngriffin_uk/polychat-schemas";

import { buildEnvelopeContext, openJson, sealJson } from "./envelope";
import {
  createConversationKeyMaterial,
  createRecoveryKey,
  createSalt,
  deriveKeyFromPassword,
  deriveKeyFromPrfOutput,
  deriveKeyFromRecoveryKey,
  toConversationKey,
  unwrapConversationKeyMaterial,
  wrapConversationKey,
} from "./keys";
import { createPrfSalt, evaluatePasskeyPrf } from "./passkey";

export { isPasskeyEncryptionSupported, PasskeyPrfUnavailableError } from "./passkey";
export { createRecoveryKey, normaliseRecoveryKey } from "./keys";

/** The plaintext shape of one sealed message. */
export interface LockedMessagePayload {
  content: string;
  model?: string | null;
  reasoning?: string | null;
  timestamp?: number;
}

export interface DecryptedLockedMessage extends LockedMessagePayload {
  id: string;
  seq: number;
  role: LockedMessage["role"];
  created_at: string;
}

export class ConversationLockKeyError extends Error {
  constructor(message = "That did not open this conversation.") {
    super(message);
    this.name = "ConversationLockKeyError";
  }
}

function messageContext(conversationId: string, message: { id: string; seq: number }): Uint8Array {
  return buildEnvelopeContext(["message", conversationId, message.id, String(message.seq)]);
}

function titleContext(conversationId: string): Uint8Array {
  return buildEnvelopeContext(["title", conversationId]);
}

export interface NewLockMaterial {
  keys: ConversationLockKeyInput[];
  conversationKey: CryptoKey;
  material: Uint8Array;
  recoveryKey: string;
}

export type LockEntryMethod =
  | { type: "passkey"; credentialId?: string | null; label?: string | null }
  | { type: "password"; password: string };

/**
 * Builds the wrapped-key set for a new lock. The recovery key is always created, because
 * a passkey can be lost and a password can be forgotten with no server-side reset.
 */
export async function createLockMaterial(
  conversationId: string,
  method: LockEntryMethod,
): Promise<NewLockMaterial> {
  const material = createConversationKeyMaterial();
  const recoveryKey = createRecoveryKey();
  const keys: ConversationLockKeyInput[] = [];

  if (method.type === "passkey") {
    const salt = createPrfSalt();
    const secret = await evaluatePasskeyPrf({
      salt,
      credentialId: method.credentialId,
    });

    keys.push({
      type: "passkey",
      credential_id: secret.credentialId,
      label: method.label ?? null,
      salt,
      kdf: null,
      kdf_iterations: null,
      wrapped_key: await wrapConversationKey(
        await deriveKeyFromPrfOutput(secret.output),
        conversationId,
        material,
      ),
    });
  } else {
    const salt = createSalt();

    keys.push({
      type: "password",
      credential_id: null,
      label: null,
      salt,
      kdf: "pbkdf2-sha256",
      kdf_iterations: CONVERSATION_LOCK_PBKDF2_ITERATIONS,
      wrapped_key: await wrapConversationKey(
        await deriveKeyFromPassword(method.password, salt),
        conversationId,
        material,
      ),
    });
  }

  keys.push({
    type: "recovery",
    credential_id: null,
    label: null,
    salt: createSalt(),
    kdf: null,
    kdf_iterations: null,
    wrapped_key: await wrapConversationKey(
      await deriveKeyFromRecoveryKey(recoveryKey),
      conversationId,
      material,
    ),
  });

  return {
    keys,
    conversationKey: await toConversationKey(material),
    material,
    recoveryKey,
  };
}

/**
 * Wraps the already-open conversation key with another entry method, so a conversation
 * unlocked by passkey can also gain a password without re-encrypting a single message.
 */
export async function createAdditionalLockKey(params: {
  conversationId: string;
  conversationKeyMaterial: Uint8Array;
  method: LockEntryMethod;
}): Promise<ConversationLockKeyInput> {
  const { conversationId, conversationKeyMaterial, method } = params;

  if (method.type === "passkey") {
    const salt = createPrfSalt();
    const secret = await evaluatePasskeyPrf({
      salt,
      credentialId: method.credentialId,
    });

    return {
      type: "passkey",
      credential_id: secret.credentialId,
      label: method.label ?? null,
      salt,
      kdf: null,
      kdf_iterations: null,
      wrapped_key: await wrapConversationKey(
        await deriveKeyFromPrfOutput(secret.output),
        conversationId,
        conversationKeyMaterial,
      ),
    };
  }

  const salt = createSalt();

  return {
    type: "password",
    credential_id: null,
    label: null,
    salt,
    kdf: "pbkdf2-sha256",
    kdf_iterations: CONVERSATION_LOCK_PBKDF2_ITERATIONS,
    wrapped_key: await wrapConversationKey(
      await deriveKeyFromPassword(method.password, salt),
      conversationId,
      conversationKeyMaterial,
    ),
  };
}

export type UnlockAttempt =
  | { type: "passkey" }
  | { type: "password"; password: string }
  | { type: "recovery"; recoveryKey: string };

export interface UnlockResult {
  /** Raw key material. Held only for as long as an unlock flow needs it. */
  material: Uint8Array;
  keyId: string;
}

async function unwrapWith(
  wrappingKey: CryptoKey,
  conversationId: string,
  candidate: ConversationLockKey,
): Promise<UnlockResult | null> {
  try {
    return {
      material: await unwrapConversationKeyMaterial(
        wrappingKey,
        conversationId,
        candidate.wrapped_key,
      ),
      keyId: candidate.id,
    };
  } catch {
    return null;
  }
}

/**
 * Wrong credentials fail the AES-GCM tag, which is why there is no separate verifier
 * stored anywhere: the wrapped key is its own proof.
 */
export async function unlockConversation(
  lock: ConversationLock,
  attempt: UnlockAttempt,
): Promise<UnlockResult> {
  const conversationId = lock.conversation_id;

  if (attempt.type === "passkey") {
    for (const candidate of lock.keys.filter((key) => key.type === "passkey")) {
      const secret = await evaluatePasskeyPrf({
        salt: candidate.salt,
        credentialId: candidate.credential_id,
      });
      const result = await unwrapWith(
        await deriveKeyFromPrfOutput(secret.output),
        conversationId,
        candidate,
      );

      if (result) {
        return result;
      }
    }

    throw new ConversationLockKeyError("That passkey does not open this conversation.");
  }

  if (attempt.type === "password") {
    for (const candidate of lock.keys.filter((key) => key.type === "password")) {
      const result = await unwrapWith(
        await deriveKeyFromPassword(
          attempt.password,
          candidate.salt,
          candidate.kdf_iterations ?? CONVERSATION_LOCK_PBKDF2_ITERATIONS,
        ),
        conversationId,
        candidate,
      );

      if (result) {
        return result;
      }
    }

    throw new ConversationLockKeyError("That password does not open this conversation.");
  }

  let recoveryWrappingKey: CryptoKey;

  try {
    recoveryWrappingKey = await deriveKeyFromRecoveryKey(attempt.recoveryKey);
  } catch {
    throw new ConversationLockKeyError("That is not a valid recovery key.");
  }

  for (const candidate of lock.keys.filter((key) => key.type === "recovery")) {
    const result = await unwrapWith(recoveryWrappingKey, conversationId, candidate);

    if (result) {
      return result;
    }
  }

  throw new ConversationLockKeyError("That recovery key does not open this conversation.");
}

export async function sealMessage(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  id: string;
  seq: number;
  role: LockedMessage["role"];
  payload: LockedMessagePayload;
}): Promise<LockedMessageInput> {
  const { conversationId, conversationKey, id, seq, role, payload } = params;

  return {
    id,
    seq,
    role,
    envelope: await sealJson(conversationKey, payload, messageContext(conversationId, { id, seq })),
  };
}

export async function openMessage(params: {
  conversationId: string;
  conversationKey: CryptoKey;
  message: LockedMessage;
}): Promise<DecryptedLockedMessage> {
  const { conversationId, conversationKey, message } = params;
  const payload = await openJson<LockedMessagePayload>(
    conversationKey,
    message.envelope,
    messageContext(conversationId, message),
  );

  return {
    ...payload,
    id: message.id,
    seq: message.seq,
    role: message.role,
    created_at: message.created_at,
  };
}

export async function sealTitle(
  conversationId: string,
  conversationKey: CryptoKey,
  title: string,
): Promise<SealedEnvelope> {
  return sealJson(conversationKey, { title }, titleContext(conversationId));
}

export async function openTitle(
  conversationId: string,
  conversationKey: CryptoKey,
  envelope: SealedEnvelope,
): Promise<string> {
  const payload = await openJson<{ title: string }>(
    conversationKey,
    envelope,
    titleContext(conversationId),
  );

  return payload.title;
}

export { toConversationKey };
export { CONVERSATION_LOCK_VERSION };
