import {
  SECRET_REFERENCE_PREFIX,
  SECRET_REFERENCE_TTL_SECONDS,
  secretReferenceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { generateId, randomHex } from "@ngriffin_uk/polychat-utility-core";
import {
  hmacSha256,
  sha256Hex,
  timingSafeEqual,
  toHex,
} from "@ngriffin_uk/polychat-utility-server/crypto";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { normaliseHttpOrigin } from "@ngriffin_uk/polychat-utility-server/urls";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";
import { ConversationRepository } from "~/modules/conversations/infrastructure/ConversationRepository";
import { SecretReferenceRepository } from "~/modules/secret-requests/infrastructure/SecretReferenceRepository";
import type { IEnv } from "~/types";

type SecretReferenceContext = Pick<ServiceContext, "env" | "repositories">;

export interface SecretReferenceBinding {
  userId: number;
  projectId: string | null;
  conversationId: string;
}

export interface IssuedSecretReference {
  reference: string;
  expiresAt: string;
}

export interface RedeemedSecret {
  value: string;
  label: string;
  destination: string | null;
}

function signingSecret(env: Pick<IEnv, "JWT_SECRET">): string {
  const secret = env.JWT_SECRET?.trim();

  if (!secret) {
    throw new AssistantError("Secret references are not configured", ErrorType.CONFIGURATION_ERROR);
  }

  return secret;
}

function unusableReference(): AssistantError {
  return new AssistantError(
    "The secret reference is invalid, expired, already used or belongs to another conversation. Ask the user for the secret again with request_secret.",
    ErrorType.FORBIDDEN,
    403,
  );
}

async function deriveReference(
  env: Pick<IEnv, "JWT_SECRET">,
  params: SecretReferenceBinding & { id: string; salt: string },
): Promise<string> {
  const signature = await hmacSha256(
    signingSecret(env),
    [
      "secret-reference.v1",
      params.id,
      String(params.userId),
      params.projectId ?? "personal",
      params.conversationId,
      params.salt,
    ].join("\n"),
  );

  return `${SECRET_REFERENCE_PREFIX}${toHex(signature)}`;
}

export async function resolveConversationSecretBinding(
  context: SecretReferenceContext,
  userId: number,
  conversationId: string,
): Promise<SecretReferenceBinding> {
  const conversation = await context.repositories
    .get(ConversationRepository)
    .getConversation(conversationId);

  if (!conversation) {
    throw new AssistantError("Conversation not found", ErrorType.NOT_FOUND, 404);
  }

  return {
    userId,
    conversationId,
    projectId:
      typeof conversation.project_id === "string" && conversation.project_id
        ? conversation.project_id
        : null,
  };
}

export async function issueSecretReference(
  context: SecretReferenceContext,
  params: SecretReferenceBinding & {
    interactionId: string;
    label: string;
    destination: string | null;
    value: string;
    now?: Date;
  },
): Promise<IssuedSecretReference> {
  const now = params.now ?? new Date();
  const id = generateId();
  const salt = randomHex(32).toLowerCase();
  const reference = await deriveReference(context.env, { ...params, id, salt });
  const expiresAt = new Date(now.getTime() + SECRET_REFERENCE_TTL_SECONDS * 1000).toISOString();
  const repository = context.repositories.get(SecretReferenceRepository);

  await repository.deleteExpiredForUser(params.userId, now.toISOString());
  await repository.replaceForInteraction({
    id,
    reference_hash: await sha256Hex(reference),
    salt,
    user_id: params.userId,
    project_id: params.projectId,
    conversation_id: params.conversationId,
    interaction_id: params.interactionId,
    label: params.label,
    destination: params.destination,
    sealed_value: await sealSecret(context.env, params.value),
    created_at: now.toISOString(),
    expires_at: expiresAt,
  });

  return { reference, expiresAt };
}

export async function redeemSecretReference(
  context: SecretReferenceContext,
  params: SecretReferenceBinding & { reference: string; destination: string; now?: Date },
): Promise<RedeemedSecret> {
  if (!secretReferenceSchema.safeParse(params.reference).success) {
    throw unusableReference();
  }

  const now = (params.now ?? new Date()).toISOString();
  const repository = context.repositories.get(SecretReferenceRepository);
  const record = await repository.findByHash(await sha256Hex(params.reference));

  if (!record || record.expires_at <= now) {
    throw unusableReference();
  }

  const expected = await deriveReference(context.env, {
    id: record.id,
    salt: record.salt,
    userId: params.userId,
    projectId: params.projectId,
    conversationId: params.conversationId,
  });

  if (!timingSafeEqual(expected, params.reference)) {
    throw unusableReference();
  }

  if (record.destination && record.destination !== normaliseHttpOrigin(params.destination)) {
    throw new AssistantError(
      `This secret can only be sent to ${record.destination}.`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const consumed = await repository.consume({
    id: record.id,
    userId: params.userId,
    projectId: params.projectId,
    conversationId: params.conversationId,
    now,
  });

  if (!consumed) {
    throw unusableReference();
  }

  return {
    value: await openSecret(context.env, consumed.sealed_value),
    label: consumed.label,
    destination: consumed.destination,
  };
}
