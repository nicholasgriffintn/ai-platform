import {
  CHAT_RUN_EVENT_PROTOCOL_VERSION,
  canTransitionChatRun,
  chatRetrySnapshotSchema,
  chatRunStatusSchema,
  isTerminalChatRunStatus,
  type ChatRun,
  type ChatRunReplayResponse,
  type ChatRunSnapshotResponse,
} from "@ngriffin_uk/polychat-schemas";

import type { Conversation, Message } from "~/types";

export interface ChatRunReplayState {
  cursor: number;
  snapshot: AuthoritativeChatRunSnapshot;
}

export type AuthoritativeChatRunSnapshot = Omit<ChatRunSnapshotResponse, "messages"> & {
  messages: Message[];
};

export type AppChatRunReplayResponse = Omit<ChatRunReplayResponse, "snapshot"> & {
  snapshot: AuthoritativeChatRunSnapshot | null;
};

export interface ChatRunReplayOutcome {
  state: ChatRunReplayState;
  requiresSnapshot: boolean;
  unsupportedProtocol: boolean;
}

function applyRunStatusEvent(
  run: ChatRun,
  event: ChatRunReplayResponse["events"][number],
): ChatRun | null {
  const status = chatRunStatusSchema.safeParse(event.data.status);

  if (!status.success || event.attempt < run.attempt || event.attempt > run.attempt + 1) {
    return null;
  }

  if (
    event.attempt === run.attempt &&
    isTerminalChatRunStatus(run.status) &&
    status.data !== run.status
  ) {
    return run;
  }

  if (event.attempt === run.attempt && !canTransitionChatRun(run.status, status.data)) {
    return run;
  }

  return {
    ...run,
    status: status.data,
    attempt: event.attempt,
    updatedAt: event.occurredAt,
    completedAt: isTerminalChatRunStatus(status.data)
      ? event.occurredAt
      : status.data === "running"
        ? null
        : run.completedAt,
    terminalReason:
      typeof event.data.terminalReason === "string"
        ? event.data.terminalReason
        : status.data === "running"
          ? null
          : run.terminalReason,
    lastMessageId:
      typeof event.data.lastMessageId === "string" ? event.data.lastMessageId : run.lastMessageId,
    context: event.attempt === run.attempt ? run.context : null,
    usage: event.attempt === run.attempt ? run.usage : undefined,
    retry: null,
  };
}

function applyRunRetryEvent(
  run: ChatRun,
  event: ChatRunReplayResponse["events"][number],
): ChatRun | null {
  const retry = chatRetrySnapshotSchema.nullable().safeParse(event.data.retry);

  if (!retry.success || event.attempt !== run.attempt || isTerminalChatRunStatus(run.status)) {
    return null;
  }

  return { ...run, retry: retry.data, updatedAt: event.occurredAt };
}

export function applyChatRunReplay(
  state: ChatRunReplayState,
  response: AppChatRunReplayResponse,
): ChatRunReplayOutcome {
  if (response.protocolVersion > CHAT_RUN_EVENT_PROTOCOL_VERSION) {
    return { state, requiresSnapshot: true, unsupportedProtocol: true };
  }

  if (response.runId !== state.snapshot.run.id || response.fromCursor > state.cursor) {
    return { state, requiresSnapshot: true, unsupportedProtocol: false };
  }

  if (response.resetRequired) {
    if (!response.snapshot) {
      return { state, requiresSnapshot: true, unsupportedProtocol: false };
    }

    return {
      state: { cursor: response.snapshot.cursor, snapshot: response.snapshot },
      requiresSnapshot: false,
      unsupportedProtocol: false,
    };
  }

  const events = [...response.events].sort((left, right) => left.sequence - right.sequence);
  let nextRun = state.snapshot.run;
  let nextCursor = state.cursor;

  for (const event of events) {
    if (event.sequence <= nextCursor) {
      continue;
    }

    if (event.sequence !== nextCursor + 1 || event.runId !== state.snapshot.run.id) {
      return { state, requiresSnapshot: true, unsupportedProtocol: false };
    }

    if (event.protocolVersion > CHAT_RUN_EVENT_PROTOCOL_VERSION) {
      return { state, requiresSnapshot: true, unsupportedProtocol: true };
    }

    if (
      event.type !== "run.accepted" &&
      event.type !== "run.status_changed" &&
      event.type !== "run.retry_changed"
    ) {
      return { state, requiresSnapshot: true, unsupportedProtocol: false };
    }

    const updatedRun =
      event.type === "run.retry_changed"
        ? applyRunRetryEvent(nextRun, event)
        : applyRunStatusEvent(nextRun, event);

    if (!updatedRun) {
      return { state, requiresSnapshot: true, unsupportedProtocol: false };
    }

    nextRun = updatedRun;
    nextCursor = event.sequence;
  }

  return {
    state: {
      cursor: nextCursor,
      snapshot: { ...state.snapshot, cursor: nextCursor, run: nextRun },
    },
    requiresSnapshot: false,
    unsupportedProtocol: false,
  };
}

export function replaceConversationRunSnapshot(
  conversation: Conversation,
  snapshot: AuthoritativeChatRunSnapshot,
): Conversation {
  const authoritativeById = new Map<string, Message>();
  const seen = new Set<string>();
  const messages: Message[] = [];

  for (const message of snapshot.messages) {
    if (message.id) {
      authoritativeById.set(message.id, message);
    }
  }

  for (const message of conversation.messages) {
    if (message.id && authoritativeById.has(message.id)) {
      const authoritative = authoritativeById.get(message.id);

      if (authoritative) {
        messages.push(authoritative);
      }

      seen.add(message.id);
    } else if (message.run_id !== snapshot.run.id) {
      messages.push(message);
    }
  }

  for (const message of snapshot.messages) {
    if (!message.id || !seen.has(message.id)) {
      messages.push(message);
    }
  }

  return { ...conversation, latest_run: snapshot.run, messages };
}
