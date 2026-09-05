import {
  CHAT_RUN_EVENT_PROTOCOL_VERSION,
  type ChatRunReplayQuery,
  type ChatRunReplayResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";

import { reconcileInactiveChatRun } from "./recovery";
import { handleGetChatRunSnapshot, requireChatRunAccess } from "./status";

export async function handleReplayChatRunEvents(
  context: ServiceContext,
  runId: string,
  query: ChatRunReplayQuery,
): Promise<ChatRunReplayResponse> {
  await reconcileInactiveChatRun(context, await requireChatRunAccess(context, runId));
  const window = await context.repositories.conversationRuns.getEventWindow(runId);
  const retentionGap = window.oldest !== null && query.after < window.oldest - 1;
  const invalidFutureCursor = query.after > window.latest;
  const missingRetainedEvents = window.oldest === null && window.latest > 0;

  if (retentionGap || invalidFutureCursor || missingRetainedEvents) {
    const snapshot = await handleGetChatRunSnapshot(context, runId);

    return {
      protocolVersion: CHAT_RUN_EVENT_PROTOCOL_VERSION,
      runId,
      fromCursor: query.after,
      nextCursor: snapshot.cursor,
      resetRequired: true,
      events: [],
      snapshot,
    };
  }

  const events = await context.repositories.conversationRuns.listEvents(
    runId,
    query.after,
    query.limit,
  );

  const replayGap = events.some((event, index) => event.sequence !== query.after + index + 1);
  const missingPage = query.after < window.latest && events.length === 0;

  if (replayGap || missingPage) {
    const snapshot = await handleGetChatRunSnapshot(context, runId);

    return {
      protocolVersion: CHAT_RUN_EVENT_PROTOCOL_VERSION,
      runId,
      fromCursor: query.after,
      nextCursor: snapshot.cursor,
      resetRequired: true,
      events: [],
      snapshot,
    };
  }

  return {
    protocolVersion: CHAT_RUN_EVENT_PROTOCOL_VERSION,
    runId,
    fromCursor: query.after,
    nextCursor: events.at(-1)?.sequence ?? query.after,
    resetRequired: false,
    events,
    snapshot: null,
  };
}
