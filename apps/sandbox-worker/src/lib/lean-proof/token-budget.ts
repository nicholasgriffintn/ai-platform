import {
  AgentTokenBudgetExceededError,
  type AgentMessage,
  type AgentTokenUsage,
} from "@ngriffin_uk/polychat-library-agent-core";

const CHAT_COMPLETION_TOKEN_OVERHEAD = 512;

export function estimateLeanTurnInputTokens(
  messages: AgentMessage[],
  tools: readonly unknown[],
): number {
  const serialisedRequest = JSON.stringify({ messages, tools });
  const requestBytes = new TextEncoder().encode(serialisedRequest).byteLength;

  // A byte-per-token estimate plus protocol headroom is deliberately conservative for code.
  return requestBytes + CHAT_COMPLETION_TOKEN_OVERHEAD;
}

export function resolveLeanMaxOutputTokens(params: {
  messages: AgentMessage[];
  tools: readonly unknown[];
  usage: Readonly<AgentTokenUsage>;
  remainingTokenBudget: number;
  requestedMaxOutputTokens?: number;
  tokenBudget: number;
}): number {
  const estimatedInputTokens = estimateLeanTurnInputTokens(params.messages, params.tools);
  const availableOutputTokens = params.remainingTokenBudget - estimatedInputTokens;

  if (availableOutputTokens <= 0) {
    throw new AgentTokenBudgetExceededError({ ...params.usage }, params.tokenBudget);
  }

  return Math.max(
    1,
    Math.min(availableOutputTokens, params.requestedMaxOutputTokens ?? Number.POSITIVE_INFINITY),
  );
}
