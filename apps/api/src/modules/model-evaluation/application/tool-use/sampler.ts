import {
  estimateUsageCost,
  readTokenUsageCounts,
} from "@ngriffin_uk/polychat-library-chat/response-stats";
import { findMonotoneFailure } from "@ngriffin_uk/polychat-library-model-registry/tool-use";
import type {
  ToolUseEvalHistoryMessage,
  ToolUseEvalSample,
  ToolUseEvalTrajectory,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { ai } from "~/infrastructure/ai";
import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { getModelConfigByMatchingModel } from "~/modules/models/application/resolve";
import { createAgentProviderIO } from "~/modules/responses/application/engine/agent/provider-io";
import type { Message } from "~/types";

import { prepareToolUseEnvironment, type ToolUseTarget, type ToolUseTestCase } from "./environment";
import { resolveMockedToolResult } from "./mocks";

const providerIO = createAgentProviderIO();

const MAX_STEPS = 8;

export type ToolUseSampleRun = Omit<ToolUseEvalSample, "passed" | "failures">;

function toolResultMessage(call: { id: string; tool: string; result: unknown }): Message {
  return {
    role: "tool",
    name: call.tool,
    tool_call_id: call.id,
    status: "success",
    content: typeof call.result === "string" ? call.result : JSON.stringify(call.result),
  };
}

function historyMessages(history: readonly ToolUseEvalHistoryMessage[]): Message[] {
  return history.flatMap((message): Message[] => {
    if (message.role === "user" || message.calls.length === 0) {
      return [{ role: message.role, content: message.content }];
    }

    const calls = message.calls.map((call) => ({ ...call, id: generateId() }));

    return [
      {
        role: "assistant",
        content: message.content,
        tool_calls: providerIO.providerToolCalls(
          calls.map((call) => ({ id: call.id, name: call.tool, arguments: call.args })),
        ),
      },
      ...calls.map(toolResultMessage),
    ];
  });
}

function addUsage(totals: { inputTokens: number; outputTokens: number }, usage: unknown) {
  const counts = readTokenUsageCounts(usage);

  totals.inputTokens += counts?.inputTokens ?? 0;
  totals.outputTokens += counts?.outputTokens ?? 0;
}

export async function sampleToolUseCase(params: {
  context: ServiceContext;
  testCase: ToolUseTestCase;
  target: ToolUseTarget;
}): Promise<ToolUseSampleRun> {
  const { context, testCase, target } = params;
  const started = Date.now();
  const scope = { env: context.env, user: context.requireUser() };
  const { spec } = testCase;
  const environment = await prepareToolUseEnvironment({ context, testCase, target });
  const messages: Message[] = [
    ...historyMessages(spec.setup.history),
    { role: "user", content: testCase.prompt },
  ];
  const trajectory: ToolUseEvalTrajectory = { calls: [], texts: [], finalText: "" };
  const usage = { inputTokens: 0, outputTokens: 0 };
  let stoppedEarly: string | null = null;
  let steps = 0;
  let finished = false;

  while (steps < MAX_STEPS && !finished && !stoppedEarly) {
    steps += 1;

    const completion = await ai.complete({
      env: scope.env,
      user: scope.user,
      model: target.model,
      provider: target.provider,
      system: environment.systemPrompt,
      messages,
      available_functions: environment.functions,
    });
    const response = providerIO.modelResponse(completion.raw);
    const toolCalls = providerIO.agentToolCalls(response.tool_calls ?? []);

    addUsage(usage, completion.usage ?? response.usage);

    if (completion.text) {
      trajectory.texts.push(completion.text);
    }

    if (toolCalls.length === 0) {
      trajectory.finalText = completion.text;
      finished = true;
      continue;
    }

    messages.push({
      role: "assistant",
      content: completion.text,
      tool_calls: providerIO.providerToolCalls(toolCalls),
    });

    for (const toolCall of toolCalls) {
      const mocked = await resolveMockedToolResult({
        env: scope.env,
        user: scope.user,
        spec,
        tool: toolCall.name,
        description: environment.descriptions.get(toolCall.name),
        args: toolCall.arguments,
      });

      trajectory.calls.push({
        tool: toolCall.name,
        args: toolCall.arguments,
        result: mocked.result,
        step: steps,
        mocked: mocked.mocked,
      });
      messages.push(
        toolResultMessage({ id: toolCall.id, tool: toolCall.name, result: mocked.result }),
      );
    }

    const failure = findMonotoneFailure(spec.expect, trajectory);

    stoppedEarly = failure ? `${failure.check}: ${failure.detail}` : null;
  }

  const modelConfig = await getModelConfigByMatchingModel(
    target.model,
    scope.env,
    target.provider,
    scope.user.id,
  );

  return {
    trajectory,
    stoppedEarly: stoppedEarly ?? (finished ? null : "max_steps"),
    steps,
    advertisedTools: [...environment.descriptions.keys()],
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costUsd: estimateUsageCost(usage, modelConfig ?? undefined) ?? null,
    durationMs: Date.now() - started,
  };
}
