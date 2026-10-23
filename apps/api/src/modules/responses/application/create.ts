import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  chatRunCommandReceiptSchema,
  isPolyTeammateId,
  messageToItem,
  toResponse,
  type ChatCompletionResponseBody,
  type ParsedCreateResponseRequest,
  type PlatformResponse,
  type StoredItem,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  enqueueTeammateRun,
  resumeTeammateRun,
} from "~/modules/teammates/application/run-admission";
import type { AnonymousUser, IUser } from "~/types";

import type { ResponseAuthority } from "../domain/command";
import { prepareConversationCompletion } from "./prepare";
import { toResponseCommand } from "./request-mapping";

export interface CreateResponseInput {
  context: ServiceContext;
  request: ParsedCreateResponseRequest;
  authority?: ResponseAuthority;
  user?: IUser;
  anonymousUser?: AnonymousUser;
  executionCtx?: ExecutionContext;
  signal?: AbortSignal;
  location?: { longitude?: number; latitude?: number };
  platform?: string;
}

function completionOutput(result: ChatCompletionResponseBody): StoredItem[] {
  const compaction = result.post_processing?.compaction?.message;
  const items: StoredItem[] = compaction ? [messageToItem(compaction)] : [];

  for (const choice of result.choices ?? []) {
    items.push(messageToItem(choice.message));
  }

  return items;
}

export function completionToResponse(
  result: ChatCompletionResponseBody,
  fallback: { conversationId?: string; userId?: number },
): PlatformResponse {
  const output = completionOutput(result);

  if (result.run) {
    const receipt = chatRunCommandReceiptSchema.parse(result.run);

    return toResponse(receipt.run, { receipt, output });
  }

  const createdAt = new Date(result.created).toISOString();

  return {
    object: "response",
    id: result.id,
    conversation_id: fallback.conversationId ?? result.id,
    status: "completed",
    waiting_on: null,
    attempt: 1,
    trigger: "user",
    initiator_user_id: fallback.userId ?? null,
    project_id: null,
    project_task_id: null,
    created_at: createdAt,
    updated_at: createdAt,
    started_at: createdAt,
    completed_at: createdAt,
    terminal_reason: null,
    last_item_id: output.at(-1)?.id ?? null,
    output,
  };
}

export async function createResponse({
  context,
  request,
  authority,
  user,
  anonymousUser,
  executionCtx,
  signal,
  location,
  platform,
}: CreateResponseInput): Promise<PlatformResponse | Response> {
  const teammateId = request.agent?.type === "teammate" ? request.agent.id : undefined;
  const command = toResponseCommand(request, {
    platform,
    poly: isPolyTeammateId(teammateId),
  });
  const result = teammateId
    ? await (command.settings?.options?.toolInteraction ? resumeTeammateRun : enqueueTeammateRun)({
        env: context.env,
        context,
        body: command,
        teammateId,
        user,
        anonymousUser,
        executionCtx,
        signal,
        authority,
      })
    : await prepareConversationCompletion({
        context,
        request: command,
        authority,
        user,
        anonymousUser,
        executionCtx,
        signal,
        location: location ?? {},
      });

  if (result instanceof Response) {
    return result;
  }

  return completionToResponse(result, {
    conversationId: command.conversationId,
    userId: user?.id,
  });
}
