import type { RunChargeState } from "@ngriffin_uk/polychat-ai-billing";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RunBudget } from "~/modules/usage/application/run-budget";
import type { Message, ToolCall } from "~/types";

import { runAgentLoop, type AgentLoopExecutionParams } from "../agent-loop";

const CREDIT = 1_000_000;
const STEP_COST = 30 * CREDIT;

const ledger = vi.hoisted(() => ({ charged: 0, stepCost: 0 }));

vi.mock("../assistant-turn", () => ({
  finaliseAssistantTurn: vi.fn(async ({ turn }: { turn: { content: string; usage?: unknown } }) => {
    if (turn.usage) {
      ledger.charged += ledger.stepCost;
    }

    return {
      message: { role: "assistant", content: turn.content, id: "message" },
      guardrailsPassed: true,
      guardrailViolations: [],
    };
  }),
}));

vi.mock("~/modules/responses/application/engine/tools/execution", () => ({
  handleToolCalls: vi.fn(async (_id: string, turn: { tool_calls: ToolCall[] }) =>
    turn.tool_calls.map((call) => ({
      role: "tool",
      name: call.function.name,
      content: "done",
      status: "success",
      tool_call_id: call.id,
    })),
  ),
}));

vi.mock("../conversation-title", () => ({
  startConversationTitle: () => ({ complete: async () => undefined }),
}));

vi.mock("../memory-capture", () => ({ captureRunMemories: async () => [] }));

function toolTurn(step: number) {
  return {
    content: `Working on step ${step}`,
    usage: { input_tokens: 10, output_tokens: 10 },
    toolCalls: [
      { id: `call-${step}`, type: "function", function: { name: "web_search", arguments: "{}" } },
    ],
  };
}

function capBudget(capCreditMicros: number) {
  return new RunBudget({
    runId: "run-1",
    capCreditMicros,
    store: {
      getRunChargeState: async (): Promise<RunChargeState> => ({
        capCreditMicros,
        refunded: false,
        chargedCreditMicros: ledger.charged,
      }),
    },
    modelConfig: {
      costPer1kInputTokens: 0,
      costPer1kOutputTokens: 0.31,
      maxTokens: 1000,
    } as ConstructorParameters<typeof RunBudget>[0]["modelConfig"],
    modelCostIsCharged: true,
  });
}

function runParams(runBudget: RunBudget, stored: Message[], events: unknown[]) {
  const runTurn = vi.fn(async ({ context }: { context: { step: number } }) =>
    toolTurn(context.step),
  );

  return {
    runTurn,
    params: {
      requestParams: { messages: [{ role: "user", content: "Do the work" }], store: true },
      completionId: "conversation-1",
      conversationManager: {
        add: vi.fn(async (_id: string, message: Message) => {
          stored.push(message);
        }),
        getUsageLimits: vi.fn(async () => null),
      },
      toolRequestContext: {},
      transport: { streams: false, runTurn },
      maxSteps: 20,
      env: {},
      model: "claude",
      provider: "anthropic",
      platform: "web",
      mode: "agent",
      memoryScope: { type: "personal" },
      sink: { write: async (event: unknown) => void events.push(event) },
      runId: "run-1",
      runAttempt: 1,
      runBudget,
    } as unknown as AgentLoopExecutionParams,
  };
}

describe("a capped run", () => {
  beforeEach(() => {
    ledger.charged = 0;
    ledger.stepCost = STEP_COST;
  });

  it("stops before any step that could overspend, with no further model call", async () => {
    const stored: Message[] = [];
    const events: Array<{ type?: string; meter?: { chargedCreditMicros: number } }> = [];
    const cap = 100 * CREDIT;
    const { params, runTurn } = runParams(capBudget(cap), stored, events);

    const result = await runAgentLoop(params);

    expect(ledger.charged).toBeLessThanOrEqual(cap);
    expect(runTurn).toHaveBeenCalledTimes(3);
    expect(result.response.status).toBe("usage_limit_reached");
  });
});
