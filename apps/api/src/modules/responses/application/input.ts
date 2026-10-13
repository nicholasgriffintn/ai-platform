import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  createResponseRequestSchema,
  isStoredItem,
  itemToMessage,
  queuedChatUserMessageSchema,
  type PlatformResponse,
  type QueuedChatMessage,
  type ResponseInputRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { AnonymousUser, IUser } from "~/types";

import { createResponse } from "./create";
import { queueFollowUp } from "./runs/follow-up-queue";
import { requireChatRunAccess } from "./runs/status";

export interface SubmitResponseInputParams {
  context: ServiceContext;
  responseId: string;
  request: ResponseInputRequest;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  platform?: string;
}

export type SubmitResponseInputResult =
  | PlatformResponse
  | Response
  | { object: "queued_item"; queued: QueuedChatMessage };

export async function submitResponseInput({
  context,
  responseId,
  request,
  user,
  anonymousUser,
  executionCtx,
  signal,
  platform,
}: SubmitResponseInputParams): Promise<SubmitResponseInputResult> {
  const run = await requireChatRunAccess(context, responseId);

  if (request.when === "after") {
    const stored = request.input.find(isStoredItem);

    if (!stored || stored.type !== "message" || stored.role !== "user") {
      throw new AssistantError(
        "Only a user message can be queued for after this response",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    const queued = await queueFollowUp(context, run.conversationId, {
      message: queuedChatUserMessageSchema.parse(itemToMessage(stored)),
      request: {},
    });

    return { object: "queued_item", queued };
  }

  return createResponse({
    context,
    request: createResponseRequestSchema.parse({
      conversation: run.conversationId,
      response_id: run.id,
      input: request.input,
      idempotency_key: request.idempotency_key,
      stream: request.stream,
      client: request.client,
    }),
    user,
    anonymousUser,
    executionCtx,
    signal,
    platform,
  });
}
