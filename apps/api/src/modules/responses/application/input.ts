import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  answerUserQuestionsSchema,
  createResponseRequestSchema,
  resolveProjectTaskToolApprovalSchema,
  isStoredItem,
  itemToMessage,
  queuedChatUserMessageSchema,
  type PlatformResponse,
  type InteractionResponseItem,
  type QueuedChatMessage,
  type ResponseInputRequest,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  respondToProjectTaskQuestions,
  respondToProjectTaskToolApproval,
} from "~/modules/project-tasks/application";
import type { AnonymousUser, IUser } from "~/types";

import { createResponse } from "./create";
import { getResponse } from "./read";
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

async function resumeProjectTaskInteraction(
  context: ServiceContext,
  projectId: string,
  taskId: string,
  interaction: InteractionResponseItem,
): Promise<void> {
  if (interaction.tool_name === "ask_user") {
    await respondToProjectTaskQuestions(
      context,
      projectId,
      taskId,
      answerUserQuestionsSchema.parse(interaction.response),
    );

    return;
  }

  await respondToProjectTaskToolApproval(
    context,
    projectId,
    taskId,
    resolveProjectTaskToolApprovalSchema.parse(interaction.response),
  );
}

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
  const interaction = request.input.find(
    (item): item is InteractionResponseItem => item.type === "interaction_response",
  );

  if (run.projectId && run.projectTaskId && interaction) {
    await resumeProjectTaskInteraction(context, run.projectId, run.projectTaskId, interaction);

    return getResponse(context, run.id);
  }

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
