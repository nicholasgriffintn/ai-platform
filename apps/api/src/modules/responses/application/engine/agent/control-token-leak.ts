import type { TurnOutput } from "~/modules/responses/application/engine/agent/assistant-turn";

export const CONTROL_TOKEN_LEAK_FAILURE = "control_token_leak";

const CONTROL_TOKEN_PATTERN =
  /<\|start\|>assistant\b|<\|call\|>\s*$|^\s*(?:analysis|commentary)<\|(?:end|message)\|>|\bassistant(?:analysis|final)\b/u;

export function hasControlTokenLeak(turn: Pick<TurnOutput, "content" | "toolCalls">): boolean {
  return turn.toolCalls.length === 0 && CONTROL_TOKEN_PATTERN.test(turn.content);
}
