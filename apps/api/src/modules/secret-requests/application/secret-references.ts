import {
  SECRET_REFERENCE_PREFIX,
  SECRET_REFERENCE_TTL_SECONDS,
  secretReferenceSchema,
} from "@ngriffin_uk/polychat-schemas";
import { randomHex } from "@ngriffin_uk/polychat-utility-core";
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
import {
  SecretReferenceRepository,
  type SecretReferenceRecord,
} from "~/modules/secret-requests/infrastructure/SecretReferenceRepository";
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
  destination: string;
  release: () => Promise<void>;
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
  params: SecretReferenceBinding & { salt: string },
): Promise<string> {
  const signature = await hmacSha256(
    signingSecret(env),
    [
      "secret-reference.v1",
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

export async function createSecretReferenceRecord(
  env: Pick<IEnv, "JWT_SECRET" | "PRIVATE_KEY">,
  params: SecretReferenceBinding & {
    interactionId: string;
    label: string;
    destination: string;
    value: string;
    now: Date;
  },
): Promise<{ record: SecretReferenceRecord; reference: string }> {
  const salt = randomHex(32).toLowerCase();
  const reference = await deriveReference(env, { ...params, salt });

  return {
    reference,
    record: {
      token_hash: await sha256Hex(reference),
      salt,
      user_id: params.userId,
      project_id: params.projectId,
      conversation_id: params.conversationId,
      interaction_id: params.interactionId,
      label: params.label,
      destination: params.destination,
      sealed_value: await sealSecret(env, params.value),
      created_at: params.now.toISOString(),
      expires_at: new Date(
        params.now.getTime() + SECRET_REFERENCE_TTL_SECONDS * 1000,
      ).toISOString(),
    },
  };
}

export async function verifySecretReference(
  env: Pick<IEnv, "JWT_SECRET">,
  params: {
    record: SecretReferenceRecord | null;
    binding: SecretReferenceBinding;
    reference: string;
    destination: string;
    now: string;
  },
): Promise<SecretReferenceRecord> {
  const { record } = params;

  if (!record || record.expires_at <= params.now) {
    throw unusableReference();
  }

  const expected = await deriveReference(env, { ...params.binding, salt: record.salt });

  if (!timingSafeEqual(expected, params.reference)) {
    throw unusableReference();
  }

  if (record.destination !== normaliseHttpOrigin(params.destination)) {
    throw new AssistantError(
      `This secret can only be sent to ${record.destination}.`,
      ErrorType.FORBIDDEN,
      403,
    );
  }

  return record;
}

export async function issueSecretReference(
  context: SecretReferenceContext,
  params: SecretReferenceBinding & {
    interactionId: string;
    label: string;
    destination: string;
    value: string;
  },
): Promise<IssuedSecretReference> {
  const now = new Date();
  const { record, reference } = await createSecretReferenceRecord(context.env, {
    ...params,
    now,
  });
  const repository = context.repositories.get(SecretReferenceRepository);

  await repository.deleteExpiredForUser(params.userId, now.toISOString());
  await repository.save(record);

  return { reference, expiresAt: record.expires_at };
}

export async function redeemSecretReference(
  context: SecretReferenceContext,
  params: SecretReferenceBinding & { reference: string; destination: string },
): Promise<RedeemedSecret> {
  if (!secretReferenceSchema.safeParse(params.reference).success) {
    throw unusableReference();
  }

  const now = new Date().toISOString();
  const repository = context.repositories.get(SecretReferenceRepository);
  const { reference, destination, ...binding } = params;
  const record = await verifySecretReference(context.env, {
    record: await repository.findByHash(await sha256Hex(reference)),
    binding,
    reference,
    destination,
    now,
  });
  const consumed = await repository.consume({
    tokenHash: record.token_hash,
    userId: binding.userId,
    now,
  });

  if (!consumed) {
    throw unusableReference();
  }

  return {
    value: await openSecret(context.env, consumed.sealed_value),
    label: consumed.label,
    destination: consumed.destination,
    release: () => repository.save(consumed),
  };
}
