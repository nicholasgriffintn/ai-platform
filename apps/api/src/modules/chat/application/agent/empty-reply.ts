import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";

import type { TurnOutput } from "~/modules/chat/application/agent/assistant-turn";

export const EMPTY_REPLY_FAILURE = "empty_model_response";
export const EMPTY_REPLY_REPAIR_NOTICE = getPromptText("apps/agent-loop/empty-reply-repair");
export const EMPTY_REPLY_FALLBACK = getPromptText("apps/agent-loop/empty-reply-fallback");

const VISIBLE_ONLY_AS_TEXT = new Set(["text", "reasoning"]);

export type EmptyReplyAttempt = "retry" | "repair";

export function isEmptyTurn(turn: TurnOutput): boolean {
  return (
    !turn.stopped &&
    !turn.error &&
    turn.status !== "pending" &&
    turn.content.trim().length === 0 &&
    turn.toolCalls.length === 0 &&
    !turn.refusal &&
    turn.structuredData == null &&
    !(turn.parts ?? []).some((part) => !VISIBLE_ONLY_AS_TEXT.has(part.type))
  );
}

export function nextEmptyReplyAttempt(attemptsMade: number): EmptyReplyAttempt | null {
  if (attemptsMade === 0) {
    return "retry";
  }

  return attemptsMade === 1 ? "repair" : null;
}
