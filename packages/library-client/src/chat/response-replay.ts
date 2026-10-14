import type { Conversation, Message } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import {
  canTransitionResponse,
  chatRetrySnapshotSchema,
  isTerminalResponseStatus,
  responseStatusSchema,
  type PlatformResponse,
  type ResponseReplayResponse,
  type ResponseSnapshot,
} from "@ngriffin_uk/polychat-schemas";

export interface ResponseReplayState {
  cursor: number;
  snapshot: AuthoritativeResponseSnapshot;
}

export type AuthoritativeResponseSnapshot = Omit<ResponseSnapshot, "output"> & {
  messages: Message[];
};

export type AppResponseReplayResponse = Omit<ResponseReplayResponse, "snapshot"> & {
  snapshot: AuthoritativeResponseSnapshot | null;
};

export interface ResponseReplayOutcome {
  state: ResponseReplayState;
  requiresSnapshot: boolean;
}

type ReplayEvent = ResponseReplayResponse["data"][number];

function applyStatusEvent(response: PlatformResponse, event: ReplayEvent): PlatformResponse | null {
  const status = responseStatusSchema.safeParse(event.data.status);

  if (!status.success || event.attempt < response.attempt || event.attempt > response.attempt + 1) {
    return null;
  }

  if (
    event.attempt === response.attempt &&
    isTerminalResponseStatus(response.status) &&
    status.data !== response.status
  ) {
    return response;
  }

  if (event.attempt === response.attempt && !canTransitionResponse(response.status, status.data)) {
    return response;
  }

  return {
    ...response,
    status: status.data,
    attempt: event.attempt,
    updated_at: event.occurred_at,
    completed_at: isTerminalResponseStatus(status.data)
      ? event.occurred_at
      : status.data === "in_progress"
        ? null
        : response.completed_at,
    terminal_reason:
      typeof event.data.terminalReason === "string"
        ? event.data.terminalReason
        : status.data === "in_progress"
          ? null
          : response.terminal_reason,
    last_item_id:
      typeof event.data.lastMessageId === "string"
        ? event.data.lastMessageId
        : response.last_item_id,
    context: event.attempt === response.attempt ? response.context : null,
    usage: event.attempt === response.attempt ? response.usage : undefined,
    retry: null,
  };
}

function applyRetryEvent(response: PlatformResponse, event: ReplayEvent): PlatformResponse | null {
  const retry = chatRetrySnapshotSchema.nullable().safeParse(event.data.retry);

  if (
    !retry.success ||
    event.attempt !== response.attempt ||
    isTerminalResponseStatus(response.status)
  ) {
    return null;
  }

  return { ...response, retry: retry.data, updated_at: event.occurred_at };
}

export function applyResponseReplay(
  state: ResponseReplayState,
  replay: AppResponseReplayResponse,
): ResponseReplayOutcome {
  if (replay.response_id !== state.snapshot.id || replay.from_cursor > state.cursor) {
    return { state, requiresSnapshot: true };
  }

  if (replay.reset_required) {
    if (!replay.snapshot) {
      return { state, requiresSnapshot: true };
    }

    return {
      state: { cursor: replay.snapshot.cursor, snapshot: replay.snapshot },
      requiresSnapshot: false,
    };
  }

  const events = [...replay.data].sort((left, right) => left.sequence - right.sequence);
  const { messages, cursor: _cursor, ...response } = state.snapshot;
  let next: PlatformResponse = response;
  let nextCursor = state.cursor;

  void _cursor;

  for (const event of events) {
    if (event.sequence <= nextCursor) {
      continue;
    }

    if (event.sequence !== nextCursor + 1 || event.response_id !== state.snapshot.id) {
      return { state, requiresSnapshot: true };
    }

    if (
      event.type !== "response.created" &&
      event.type !== "response.status_changed" &&
      event.type !== "response.retry_changed"
    ) {
      return { state, requiresSnapshot: true };
    }

    const updated =
      event.type === "response.retry_changed"
        ? applyRetryEvent(next, event)
        : applyStatusEvent(next, event);

    if (!updated) {
      return { state, requiresSnapshot: true };
    }

    next = updated;
    nextCursor = event.sequence;
  }

  return {
    state: {
      cursor: nextCursor,
      snapshot: { ...next, cursor: nextCursor, messages },
    },
    requiresSnapshot: false,
  };
}

export function replaceConversationResponseSnapshot(
  conversation: Conversation,
  snapshot: AuthoritativeResponseSnapshot,
): Conversation {
  const authoritativeById = new Map<string, Message>();
  const seen = new Set<string>();
  const messages: Message[] = [];
  const { messages: snapshotMessages, cursor: _cursor, ...response } = snapshot;

  void _cursor;

  for (const message of snapshotMessages) {
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
    } else if (message.run_id !== snapshot.id) {
      messages.push(message);
    }
  }

  for (const message of snapshotMessages) {
    if (!message.id || !seen.has(message.id)) {
      messages.push(message);
    }
  }

  return { ...conversation, latest_response: response, messages };
}
