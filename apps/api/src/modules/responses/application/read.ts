import {
  chatRunStatusSchema,
  listPageOf,
  messagesToItems,
  responseStatusFromRunStatus,
  toResponse,
  type CancelResponseRequest,
  type ListPage,
  type PlatformResponse,
  type ResponseReplayQuery,
  type ResponseReplayResponse,
  type ResponseSnapshot,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { handleCancelChatRun } from "./runs/cancel";
import { handleReplayChatRunEvents } from "./runs/replay";
import { handleGetChatRun, handleGetChatRunCommand, handleGetChatRunSnapshot } from "./runs/status";

export async function getResponse(
  context: ServiceContext,
  responseId: string,
): Promise<PlatformResponse> {
  const { run, messages } = await handleGetChatRun(context, responseId);

  return toResponse(run, { output: messagesToItems(messages) });
}

export async function getResponseSnapshot(
  context: ServiceContext,
  responseId: string,
): Promise<ResponseSnapshot> {
  const snapshot = await handleGetChatRunSnapshot(context, responseId);

  return {
    ...toResponse(snapshot.run),
    output: messagesToItems(snapshot.messages),
    cursor: snapshot.cursor,
  };
}

export async function replayResponseEvents(
  context: ServiceContext,
  responseId: string,
  query: ResponseReplayQuery,
): Promise<ResponseReplayResponse> {
  const replay = await handleReplayChatRunEvents(context, responseId, query);

  return {
    object: "list",
    has_more: replay.events.length >= query.limit,
    last_id: replay.events.at(-1)?.id ?? null,
    response_id: replay.runId,
    from_cursor: replay.fromCursor,
    next_cursor: replay.nextCursor,
    reset_required: replay.resetRequired,
    data: replay.events.map((event) => ({
      id: event.id,
      response_id: event.runId,
      sequence: event.sequence,
      attempt: event.attempt,
      type: event.type,
      occurred_at: event.occurredAt,
      data: presentEventData(event.data),
    })),
    snapshot: replay.snapshot
      ? {
          ...toResponse(replay.snapshot.run),
          output: messagesToItems(replay.snapshot.messages),
          cursor: replay.snapshot.cursor,
        }
      : null,
  };
}

function presentEventData(data: Record<string, unknown>): Record<string, unknown> {
  const status = chatRunStatusSchema.safeParse(data.status);

  return status.success ? { ...data, status: responseStatusFromRunStatus(status.data) } : data;
}

export async function findResponseByIdempotencyKey(
  context: ServiceContext,
  idempotencyKey: string,
): Promise<ListPage<PlatformResponse>> {
  const { run: receipt } = await handleGetChatRunCommand(context, idempotencyKey);

  return listPageOf([toResponse(receipt.run, { receipt })], (response) => response.id);
}

export async function cancelResponse(
  context: ServiceContext,
  responseId: string,
  request: CancelResponseRequest,
  platform?: string,
): Promise<PlatformResponse> {
  const { run: receipt } = await handleCancelChatRun(
    context,
    responseId,
    {
      command_id: request.idempotency_key ?? generateId(),
      expected_attempt: request.expected_attempt,
    },
    platform,
  );

  return toResponse(receipt.run, { receipt });
}
