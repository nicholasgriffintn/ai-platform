import { describe, expect, it, vi } from "vitest";

import { AgentTokenBudgetExceededError, executeAgentLoop } from "../agent-loop";
import type { AgentToolCall, AgentTurn } from "../types";

function toolCall(name: string, args: Record<string, unknown> = {}): AgentToolCall {
  return { id: `call-${name}`, name, arguments: args };
}

function turn(toolCalls: AgentToolCall[], text?: string): AgentTurn {
  return { toolCalls, text };
}

describe("executeAgentLoop", () => {
  it("finishes when the model calls the finish tool", async () => {
    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Complete the task",
      shared: {},
      state: { commandCount: 0 },
      resolveTurn: async () => turn([toolCall("finish", { summary: "Completed." })]),
      executeToolCalls: async () => {},
    });

    expect(result).toEqual({
      summary: "Completed.",
      finalPlan: "Complete the task",
      commandCount: 0,
      stepsTaken: 1,
      goalOutcome: undefined,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        iterations: 1,
      },
    });
  });

  it("aggregates provider usage and stops a run at its token budget", async () => {
    const onTokenUsage = vi.fn();

    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: {},
        tokenBudget: 10,
        onTokenUsage,
        resolveTurn: async () => ({
          toolCalls: [toolCall("run_command", { command: "check" })],
          usage: {
            inputTokens: 7,
            outputTokens: 3,
            totalTokens: 10,
            cachedInputTokens: 2,
          },
        }),
        executeToolCalls: async () => {},
      }),
    ).rejects.toBeInstanceOf(AgentTokenBudgetExceededError);
    expect(onTokenUsage).toHaveBeenCalledWith({
      inputTokens: 7,
      outputTokens: 3,
      totalTokens: 10,
      cachedInputTokens: 2,
      iterations: 1,
    });
  });

  it("exposes the remaining token budget before each provider turn", async () => {
    const remainingBudgets: Array<number | undefined> = [];

    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Plan",
      shared: {},
      state: {},
      tokenBudget: 20,
      resolveTurn: async ({ remainingTokenBudget, usage }) => {
        remainingBudgets.push(remainingTokenBudget);

        if (usage.iterations === 0) {
          return {
            toolCalls: [toolCall("run_command", { command: "check" })],
            usage: { inputTokens: 6, outputTokens: 4, totalTokens: 10 },
          };
        }

        return {
          toolCalls: [toolCall("finish", { summary: "Done." })],
          usage: { inputTokens: 5, outputTokens: 2, totalTokens: 7 },
        };
      },
      executeToolCalls: async () => {},
    });

    expect(remainingBudgets).toEqual([20, 10]);
    expect(result.usage.totalTokens).toBe(17);
  });

  it("does not request a provider turn when no token budget remains", async () => {
    const resolveTurn = vi.fn();

    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: {},
        tokenBudget: 0,
        resolveTurn,
        executeToolCalls: async () => {},
      }),
    ).rejects.toBeInstanceOf(AgentTokenBudgetExceededError);

    expect(resolveTurn).not.toHaveBeenCalled();
  });

  it("finishes on a plain text turn so single-step chat needs no special path", async () => {
    const executeToolCalls = vi.fn();
    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "hello" }],
      initialPlan: "Answer",
      shared: {},
      state: { commandCount: 0 },
      config: { maxSteps: 1 },
      resolveTurn: async () => turn([], "Here is the answer."),
      executeToolCalls,
    });

    expect(result.summary).toBe("Here is the answer.");
    expect(result.stepsTaken).toBe(1);
    expect(executeToolCalls).not.toHaveBeenCalled();
  });

  it("executes action tool calls and keeps going until finish", async () => {
    const executed: string[][] = [];
    let step = 0;

    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Plan",
      shared: {},
      state: { commandCount: 0 },
      resolveTurn: async () => {
        step += 1;

        if (step === 1) {
          return turn([toolCall("run_command", { command: "ls" })]);
        }

        return turn([toolCall("finish", { summary: "Done." })]);
      },
      executeToolCalls: async (toolCalls, context) => {
        executed.push(toolCalls.map((call) => call.name));
        context.state.commandCount = (context.state.commandCount ?? 0) + toolCalls.length;
      },
    });

    expect(executed).toEqual([["run_command"]]);
    expect(result.commandCount).toBe(1);
    expect(result.summary).toBe("Done.");
  });

  it("applies update_plan without consuming a finish", async () => {
    const emitted: string[] = [];
    const messages = [{ role: "user" as const, content: "start" }];
    let step = 0;

    const result = await executeAgentLoop({
      initialMessages: messages,
      initialPlan: "Original plan",
      shared: {},
      state: { commandCount: 0 },
      emit: async (event) => {
        emitted.push(event.type);
      },
      resolveTurn: async () => {
        step += 1;

        if (step === 1) {
          return turn([toolCall("update_plan", { plan: "Revised plan" })]);
        }

        return turn([toolCall("finish", { summary: "Finished." })]);
      },
      executeToolCalls: async () => {},
    });

    expect(result.finalPlan).toBe("Revised plan");
    expect(emitted).toContain("plan_updated");
    expect(messages).toContainEqual(
      expect.objectContaining({
        role: "tool",
        name: "update_plan",
        tool_call_id: "call-update_plan",
        content: expect.stringContaining("Revised plan"),
      }),
    );
    expect(messages).not.toContainEqual(
      expect.objectContaining({ role: "user", content: expect.stringContaining("Plan updated") }),
    );
  });

  it("records control results before requesting another provider turn", async () => {
    const messages = [{ role: "user" as const, content: "start" }];
    const recordControlToolResults = vi.fn(async (calls: AgentToolCall[]) =>
      calls.map((call) => ({
        role: "tool" as const,
        name: call.name,
        content: "recorded",
        tool_call_id: call.id,
      })),
    );
    let step = 0;

    await executeAgentLoop({
      initialMessages: messages,
      initialPlan: "Plan",
      shared: {},
      state: { commandCount: 0 },
      resolveTurn: async () => {
        step += 1;

        if (step === 1) {
          return turn([toolCall("update_plan", { plan: "Revised plan" })]);
        }

        expect(messages.at(-2)).toEqual(
          expect.objectContaining({ role: "tool", tool_call_id: "call-update_plan" }),
        );

        return turn([toolCall("finish", { summary: "Finished." })]);
      },
      executeToolCalls: async () => {},
      recordControlToolResults,
    });

    expect(recordControlToolResults).toHaveBeenCalledTimes(2);
  });

  it("rejects finish while assessFinish withholds approval", async () => {
    const summaries: string[] = [];
    let allow = false;
    let step = 0;

    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Plan",
      shared: {},
      state: { commandCount: 0 },
      resolveTurn: async () => {
        step += 1;

        return turn([toolCall("finish", { summary: `attempt-${step}` })]);
      },
      executeToolCalls: async () => {},
      assessFinish: ({ summary }) => {
        summaries.push(summary);

        if (allow) {
          return { allow: true, outcome: "satisfied" as const };
        }

        allow = true;

        return {
          allow: false,
          instruction: "The objective is not satisfied yet. Check the tests.",
        };
      },
    });

    expect(summaries).toEqual(["attempt-1", "attempt-2"]);
    expect(result.summary).toBe("attempt-2");
    expect(result.goalOutcome).toBe("satisfied");
  });

  it("pushes the rejection instruction back to the model", async () => {
    const messages = [{ role: "user" as const, content: "start" }];
    let allow = false;

    await executeAgentLoop({
      initialMessages: messages,
      initialPlan: "Plan",
      shared: {},
      state: { commandCount: 0 },
      resolveTurn: async () => turn([toolCall("finish", { summary: "done?" })]),
      executeToolCalls: async () => {},
      assessFinish: () => {
        if (allow) {
          return { allow: true };
        }

        allow = true;

        return { allow: false, instruction: "Run the suite first." };
      },
    });

    const pushed = messages.find(
      (message) =>
        typeof message.content === "string" && message.content.includes("Run the suite first."),
    );

    expect(pushed).toBeDefined();
    expect(pushed?.content).toContain("not a message from the user");
  });

  it("triggers recovery after consecutive turn failures and requires update_plan first", async () => {
    const onPlanRecovery = vi.fn();
    let attempts = 0;

    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Initial plan",
      shared: {},
      state: { commandCount: 0 },
      config: {
        maxSteps: 6,
        maxConsecutiveTurnFailures: 2,
        maxRecoveryReplans: 2,
      },
      onPlanRecovery,
      resolveTurn: async ({ requiresPlanRecovery }) => {
        attempts += 1;

        if (attempts <= 2) {
          throw new Error("Provider returned nothing usable");
        }

        if (requiresPlanRecovery) {
          return turn([toolCall("update_plan", { plan: "Recovered plan with safer steps" })]);
        }

        return turn([toolCall("finish", { summary: "Recovered and finished." })]);
      },
      executeToolCalls: async () => {},
    });

    expect(onPlanRecovery).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe("Recovered and finished.");
    expect(result.finalPlan).toBe("Recovered plan with safer steps");
  });

  it("blocks non-plan tool calls while recovery is pending", async () => {
    const executeToolCalls = vi.fn();
    let attempts = 0;

    await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Initial plan",
      shared: {},
      state: { commandCount: 0 },
      config: { maxSteps: 8, maxConsecutiveTurnFailures: 1, maxRecoveryReplans: 2 },
      resolveTurn: async ({ requiresPlanRecovery }) => {
        attempts += 1;

        if (attempts === 1) {
          throw new Error("unusable");
        }

        if (attempts === 2) {
          return turn([toolCall("run_command", { command: "rm -rf /" })]);
        }

        if (requiresPlanRecovery) {
          return turn([toolCall("update_plan", { plan: "Safer plan" })]);
        }

        return turn([toolCall("finish", { summary: "Done." })]);
      },
      executeToolCalls,
    });

    expect(executeToolCalls).not.toHaveBeenCalled();
  });

  it("extends the step budget through onStepBudgetExceeded", async () => {
    const onStepBudgetExceeded = vi.fn().mockResolvedValue({ extendBy: 2, reason: "more work" });
    let step = 0;

    const result = await executeAgentLoop({
      initialMessages: [{ role: "user", content: "start" }],
      initialPlan: "Plan",
      shared: {},
      state: { commandCount: 0 },
      config: { maxSteps: 1, maxStepExtensions: 1 },
      resolveTurn: async () => {
        step += 1;

        if (step <= 1) {
          return turn([toolCall("run_command", { command: "ls" })]);
        }

        return turn([toolCall("finish", { summary: "Done." })]);
      },
      executeToolCalls: async () => {},
      onStepBudgetExceeded,
    });

    expect(onStepBudgetExceeded).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe("Done.");
  });

  it("stops the loop when guardExecution signals cancellation", async () => {
    const resolveTurn = vi.fn();

    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: { commandCount: 0 },
        guardExecution: async () => {
          throw new Error("Agent run cancelled during execution");
        },
        resolveTurn,
        executeToolCalls: async () => {},
      }),
    ).rejects.toThrow("Agent run cancelled during execution");
    expect(resolveTurn).not.toHaveBeenCalled();
  });

  it("propagates a turn error instead of entering recovery when shouldAbortOnTurnError allows it", async () => {
    const resolveTurn = vi.fn(async () => {
      throw new Error("Fatal provider error");
    });
    const executeToolCalls = vi.fn();

    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: { commandCount: 0 },
        resolveTurn,
        shouldAbortOnTurnError: () => true,
        executeToolCalls,
      }),
    ).rejects.toThrow("Fatal provider error");
    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(executeToolCalls).not.toHaveBeenCalled();
  });

  it("gives up once repeated recovery attempts exhaust the replan budget", async () => {
    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: { commandCount: 0 },
        config: { maxConsecutiveTurnFailures: 1, maxRecoveryReplans: 0 },
        resolveTurn: async () => {
          throw new Error("Provider returned nothing usable");
        },
        executeToolCalls: async () => {},
      }),
    ).rejects.toThrow("Agent exhausted recovery replans (0)");
  });

  it("throws once the step budget cannot be extended further", async () => {
    await expect(
      executeAgentLoop({
        initialMessages: [{ role: "user", content: "start" }],
        initialPlan: "Plan",
        shared: {},
        state: { commandCount: 0 },
        config: { maxSteps: 1 },
        resolveTurn: async () => turn([toolCall("run_command", { command: "ls" })]),
        executeToolCalls: async () => {},
      }),
    ).rejects.toThrow("Agent exceeded maximum step budget (1)");
  });
});
