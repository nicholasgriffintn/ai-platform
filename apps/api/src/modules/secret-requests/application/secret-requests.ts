import {
  REQUEST_SECRET_TOOL_NAME,
  secretRequestViewDataSchema,
  type SecretRequestSubmission,
  type SubmitSecretRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { formatStoredMessage } from "~/modules/conversations/application/stored-message";
import { ConversationRunRepository } from "~/modules/conversations/infrastructure/ConversationRunRepository";
import { MessageRepository } from "~/modules/conversations/infrastructure/MessageRepository";

import { issueSecretReference, resolveConversationSecretBinding } from "./secret-references";

function notPending(): AssistantError {
  return new AssistantError(
    "This secret request is no longer waiting for a value",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

export async function submitSecretRequest(
  context: ServiceContext,
  conversationId: string,
  input: SubmitSecretRequest,
): Promise<SecretRequestSubmission> {
  const user = context.requireUser();
  const run = await context.repositories
    .get(ConversationRunRepository)
    .getForInteraction(conversationId, input.interaction_id);

  if (
    !run?.lastMessageId ||
    run.conversationId !== conversationId ||
    run.initiatorUserId !== user.id ||
    run.status !== "awaiting_takeover"
  ) {
    throw notPending();
  }

  const stored = await context.repositories.get(MessageRepository).getMessage(run.lastMessageId);
  const message = stored ? formatStoredMessage(stored) : null;
  const request = secretRequestViewDataSchema.safeParse(message?.data);

  if (
    !message ||
    message.role !== "tool" ||
    message.name !== REQUEST_SECRET_TOOL_NAME ||
    message.status !== "pending" ||
    message.tool_call_id !== input.interaction_id ||
    !request.success ||
    request.data.interactionId !== input.interaction_id
  ) {
    throw notPending();
  }

  const issued = await issueSecretReference(context, {
    ...(await resolveConversationSecretBinding(context, user.id, conversationId)),
    interactionId: input.interaction_id,
    label: request.data.label,
    destination: request.data.destination,
    value: input.value,
  });

  return {
    object: "secret_reference",
    reference: issued.reference,
    label: request.data.label,
    destination: request.data.destination,
    expires_at: issued.expiresAt,
  };
}
