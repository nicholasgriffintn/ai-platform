import type { AuthChallengeRecord } from "@ngriffin_uk/auth-core";

import {
  decryptJsonPayload,
  encryptJsonPayload,
  isEncryptedJsonPayload,
  type EncryptedJsonPayload,
} from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";

type ChallengeMetadata = Pick<
  AuthChallengeRecord,
  "tokenHash" | "provider" | "kind" | "createdAt" | "expiresAt"
>;

export function encryptAuthChallengePayload(
  record: AuthChallengeRecord,
  keyMaterial: string,
): Promise<EncryptedJsonPayload> {
  return encryptJsonPayload({
    keyMaterial,
    payload: { ...record.payload },
    additionalData: challengeContext(record),
  });
}

export function decryptAuthChallengePayload(
  metadata: ChallengeMetadata,
  value: unknown,
  keyMaterial: string,
): Promise<Record<string, unknown>> {
  if (!isEncryptedJsonPayload(value)) {
    throw new AssistantError(
      "Stored authentication challenge is not encrypted",
      ErrorType.INTERNAL_ERROR,
    );
  }

  return decryptJsonPayload({
    keyMaterial,
    encrypted: value,
    additionalData: challengeContext(metadata),
    invalidMessage: "Stored authentication challenge is invalid",
    reconnectMessage: "Stored authentication challenge could not be decrypted",
  });
}

function challengeContext(record: ChallengeMetadata): string {
  return JSON.stringify([
    1,
    "authentication-challenge",
    record.tokenHash,
    record.provider,
    record.kind,
    record.createdAt.toISOString(),
    record.expiresAt.toISOString(),
  ]);
}
