import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createResponseRequestSchema,
  isTerminalResponseStatus,
  messageToItem,
  type PlatformResponse,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { createResponse } from "~/modules/responses/application/create";
import { submitResponseInput } from "~/modules/responses/application/input";
import { cancelResponse, getResponse } from "~/modules/responses/application/read";
import type { ResponseAuthority } from "~/modules/responses/domain/command";

import { ensureTeammateContext } from "./contexts";

const EXTERNAL_AUTHORITY: ResponseAuthority = { trigger: "channel" };

export interface ExternalTeammateMessage {
  teammateId: string;
  text: string;
  idempotencyKey?: string;
  stream?: boolean;
  background?: boolean;
  platform: string;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
}

export async function teammateHomeConversationId(
  context: ServiceContext,
  teammateId: string,
): Promise<string> {
  const user = context.requireUser();
  const teammateContext = await ensureTeammateContext(context, teammateId, {
    type: "personal",
    id: String(user.id),
  });

  return teammateContext.homeConversationId;
}

export async function startExternalTeammateResponse(
  context: ServiceContext,
  message: ExternalTeammateMessage,
): Promise<PlatformResponse | Response> {
  const conversationId = await teammateHomeConversationId(context, message.teammateId);

  return createResponse({
    context,
    request: createResponseRequestSchema.parse({
      conversation: conversationId,
      agent: { type: "teammate", id: message.teammateId },
      input: message.text,
      store: true,
      stream: message.stream ?? false,
      ...(message.background ? { background: true } : {}),
      ...(message.idempotencyKey ? { idempotency_key: message.idempotencyKey } : {}),
    }),
    authority: EXTERNAL_AUTHORITY,
    user: context.requireUser(),
    executionCtx: message.executionCtx,
    signal: message.signal,
    platform: message.platform,
  });
}

export async function readExternalTeammateResponse(
  context: ServiceContext,
  teammateId: string,
  responseId: string,
): Promise<PlatformResponse | null> {
  const conversationId = await teammateHomeConversationId(context, teammateId);
  const response = await getResponse(context, responseId).catch((error: unknown) => {
    if (error instanceof AssistantError && error.type === ErrorType.NOT_FOUND) {
      return null;
    }

    throw error;
  });

  return response?.conversation_id === conversationId ? response : null;
}

export async function followUpExternalTeammateResponse(
  context: ServiceContext,
  response: PlatformResponse,
  text: string,
  platform: string,
): Promise<void> {
  if (isTerminalResponseStatus(response.status)) {
    throw new AssistantError(
      "That task has finished; send a new message in the same context",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  await submitResponseInput({
    context,
    responseId: response.id,
    request: { input: [messageToItem({ role: "user", content: text })], when: "after" },
    user: context.requireUser(),
    platform,
  });
}

export function cancelExternalTeammateResponse(
  context: ServiceContext,
  response: PlatformResponse,
  platform: string,
): Promise<PlatformResponse> {
  return cancelResponse(context, response.id, { expected_attempt: response.attempt }, platform);
}
