import { AgentTokenBudgetExceededError } from "@ngriffin_uk/polychat-library-agent-core";
import { describe, expect, it } from "vitest";

import {
  estimateLeanTurnInputTokens,
  resolveLeanMaxOutputTokens,
} from "../lean-proof/token-budget";

describe("Lean proof token budget", () => {
  const messages = [{ role: "user" as const, content: "prove the theorem" }];
  const tools = [{ type: "function", function: { name: "finish" } }];
  const usage = {
    inputTokens: 20,
    outputTokens: 10,
    totalTokens: 30,
    cachedInputTokens: 0,
    iterations: 1,
  };

  it("clamps output to the allowance left after conservative prompt input", () => {
    const estimatedInput = estimateLeanTurnInputTokens(messages, tools);

    expect(
      resolveLeanMaxOutputTokens({
        messages,
        tools,
        usage,
        remainingTokenBudget: estimatedInput + 75,
        requestedMaxOutputTokens: 200,
        tokenBudget: 1000,
      }),
    ).toBe(75);
    expect(
      resolveLeanMaxOutputTokens({
        messages,
        tools,
        usage,
        remainingTokenBudget: estimatedInput + 300,
        requestedMaxOutputTokens: 100,
        tokenBudget: 1000,
      }),
    ).toBe(100);
  });

  it("ends before requesting a turn when prompt input exhausts the allowance", () => {
    const estimatedInput = estimateLeanTurnInputTokens(messages, tools);

    expect(() =>
      resolveLeanMaxOutputTokens({
        messages,
        tools,
        usage,
        remainingTokenBudget: estimatedInput,
        tokenBudget: 1000,
      }),
    ).toThrow(AgentTokenBudgetExceededError);
  });
});
