import {
  executeAgentLoop,
  type AgentEvent,
  type AgentFinishAssessment,
  type AgentLoopState,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";

import {
  createAgentProviderIO,
  type AgentModelResponse,
  type AgentModelToolCall,
} from "~/lib/chat/agent/provider-io";
import { toProviderMessages } from "~/lib/chat/providerMessages";
import { getAIResponse } from "~/lib/chat/responses";
import { isSuccessfulToolStatus } from "~/lib/chat/tool-results";
import { handleToolCalls } from "~/lib/chat/tools";
import type { ConversationManager } from "~/lib/conversationManager";
import { extractUsagePayload } from "~/lib/usage/extractUsage";
import { isUsageExhausted } from "~/lib/usage/limitState";
import { sumTokenUsage, type NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import type { IRequest, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";

const AGENT_MAX_RECOVERY_REPLANS = 2;
const AGENT_MAX_TURN_FAILURES = 2;
const DEFAULT_INITIAL_PLAN = "Use available tools as needed, then return a final answer.";

function shouldAbortAgentTurnError(error: unknown): boolean {
  return error instanceof AssistantError && error.type !== ErrorType.PARAMS_ERROR;
}

interface ApiAgentLoopState extends AgentLoopState {
  commandCount: number;
  unknownToolRecoveryUsed: boolean;
  pendingUserAction?: string;
  lastTurnText: string;
  lastTurnToolCallCount: number;
  stoppedForUsageLimit?: boolean;
}

const USAGE_LIMIT_NOTICE =
  "You have reached your usage limit, so I stopped here rather than continuing.";

function buildUsageLimitSummary(lastTurnText: string): string {
  const progress = lastTurnText.trim();

  return progress ? `${progress}\n\n${USAGE_LIMIT_NOTICE}` : USAGE_LIMIT_NOTICE;
}

interface ApiAgentSharedContext {
  completionId: string;
  conversationManager: ConversationManager;
  toolRequestContext: IRequest;
}

export type ModelToolCall = AgentModelToolCall;

export interface AgentStepSummary {
  stepNumber: number;
  stepType: "tool-call" | "final";
  toolCallCount: number;
  toolResultCount: number;
  usage?: NormalisedTokenUsage;
}

export type ModelResponse = AgentModelResponse & {
  steps?: AgentStepSummary[];
  totalUsage?: NormalisedTokenUsage;
};

export interface AgentLoopExecutionParams {
  requestParams: Parameters<typeof getAIResponse>[0];
  completionId: string;
  conversationManager: ConversationManager;
  toolRequestContext: IRequest;
  maxSteps: number;
  emit?: (event: AgentEvent) => Promise<void>;
  assessFinish?: (context: {
    summary: string;
    step: number;
    commandCount: number;
  }) => Promise<AgentFinishAssessment> | AgentFinishAssessment;
}

export interface AgentLoopExecutionResult {
  response: ModelResponse;
  toolResponses: Message[];
}

export async function runAgentLoop(
  params: AgentLoopExecutionParams,
): Promise<AgentLoopExecutionResult> {
  const requestParams = params.requestParams;
  const providerIO = createAgentProviderIO();
  const runtimeMessages = providerIO.initialMessages(toProviderMessages(requestParams.messages));

  const state: ApiAgentLoopState = {
    commandCount: 0,
    unknownToolRecoveryUsed: false,
    lastTurnText: "",
    lastTurnToolCallCount: 0,
  };
  const toolResponses: Message[] = [];
  const steps: AgentStepSummary[] = [];
  let totalUsage: NormalisedTokenUsage | undefined;
  let stepNumber = 0;
  let finalResponse: ModelResponse | null = null;

  await executeAgentLoop<ApiAgentSharedContext, ApiAgentLoopState>({
    initialMessages: runtimeMessages,
    initialPlan: DEFAULT_INITIAL_PLAN,
    shared: {
      completionId: params.completionId,
      conversationManager: params.conversationManager,
      toolRequestContext: params.toolRequestContext,
    },
    state,
    config: {
      maxSteps: params.maxSteps,
      maxConsecutiveTurnFailures: AGENT_MAX_TURN_FAILURES,
      maxRecoveryReplans: AGENT_MAX_RECOVERY_REPLANS,
    },
    emit: params.emit,
    getCommandCount: (runtimeState) => runtimeState.commandCount,
    shouldAbortOnTurnError: shouldAbortAgentTurnError,
    assessFinish: params.assessFinish
      ? ({ summary, step }) =>
          // Stopping for the limit is not the goal failing, so it exits without
          // claiming an outcome. The goal ends as limit_reached the next time
          // it is asked, which is where the usage state is read.
          state.stoppedForUsageLimit
            ? { allow: true }
            : params.assessFinish({ summary, step, commandCount: state.commandCount })
      : undefined,
    resolveTurn: async ({ messages, step }) => {
      // One request can spend many model calls. The check at the request
      // boundary only covers the first, so every later step re-checks. Running
      // out stops the loop and returns the work already done, rather than
      // discarding a turn the user has already paid for.
      if (step > 1 && (await isUsageExhausted(params.conversationManager))) {
        state.stoppedForUsageLimit = true;

        const summary = buildUsageLimitSummary(state.lastTurnText);

        finalResponse = {
          ...finalResponse,
          response: summary,
          status: "usage_limit_reached",
        };

        return {
          toolCalls: [],
          text: summary,
          assistantMessage: { role: "assistant", content: summary },
        };
      }

      if (state.pendingUserAction) {
        const response = state.pendingUserAction;

        state.pendingUserAction = undefined;
        finalResponse = { response, status: "pending" };

        return {
          toolCalls: [],
          text: response,
          assistantMessage: { role: "assistant", content: response },
        };
      }

      const providerResponse = await getAIResponse({
        ...requestParams,
        messages: providerIO.providerMessages(messages),
        stream: false,
      });

      if (providerResponse instanceof ReadableStream) {
        throw new AssistantError(
          "Agent mode expected non-streaming model response",
          ErrorType.PROVIDER_ERROR,
        );
      }

      const modelResponse = providerIO.modelResponse(providerResponse);
      const turnUsage = sumTokenUsage(undefined, extractUsagePayload(providerResponse));

      totalUsage = sumTokenUsage(totalUsage, extractUsagePayload(providerResponse)) ?? totalUsage;

      if (!modelResponse.response && !modelResponse.tool_calls?.length) {
        throw new AssistantError("No response generated by the model", ErrorType.PROVIDER_ERROR);
      }

      if (modelResponse.tool_calls?.length) {
        state.lastTurnText = modelResponse.response ?? "";
        state.lastTurnToolCallCount = modelResponse.tool_calls.length;
        stepNumber += 1;
        steps.push({
          stepNumber,
          stepType: "tool-call",
          toolCallCount: modelResponse.tool_calls.length,
          toolResultCount: 0,
          ...(turnUsage ? { usage: turnUsage } : {}),
        });

        return {
          toolCalls: providerIO.agentToolCalls(modelResponse.tool_calls),
          text: modelResponse.response ?? "",
          assistantMessage: {
            role: "assistant",
            content: modelResponse.response || "",
            tool_calls: modelResponse.tool_calls,
          },
        };
      }

      finalResponse = modelResponse;
      stepNumber += 1;
      steps.push({
        stepNumber,
        stepType: "final",
        toolCallCount: 0,
        toolResultCount: 0,
        ...(turnUsage ? { usage: turnUsage } : {}),
      });

      return {
        toolCalls: [],
        text:
          typeof modelResponse.response === "string"
            ? modelResponse.response
            : JSON.stringify(modelResponse.response ?? ""),
        assistantMessage: {
          role: "assistant",
          content: modelResponse.response || "",
        },
      };
    },
    executeToolCalls: async (toolCalls: AgentToolCall[], context) => {
      const providerToolCalls = providerIO.providerToolCalls(toolCalls);
      const responseText = context.state.lastTurnText;

      await context.shared.conversationManager.add(context.shared.completionId, {
        role: "assistant",
        content: responseText,
        tool_calls: providerToolCalls,
      });

      const toolResults = await handleToolCalls(
        context.shared.completionId,
        {
          response: responseText,
          tool_calls: providerToolCalls,
        },
        context.shared.conversationManager,
        context.shared.toolRequestContext,
        { recoverUnknownToolCalls: !context.state.unknownToolRecoveryUsed },
      );

      if (toolResults.some((message) => message.data?.errorCode === "UNKNOWN_TOOL")) {
        context.state.unknownToolRecoveryUsed = true;
      }

      context.state.commandCount += toolResults.filter((message) =>
        isSuccessfulToolStatus(message.status),
      ).length;

      const pendingResult = toolResults.find((message) => message.status === "pending");

      if (pendingResult) {
        context.state.pendingUserAction =
          typeof pendingResult.content === "string" && pendingResult.content.trim()
            ? pendingResult.content
            : "This action is waiting for user approval.";
      }

      const currentStep = steps[steps.length - 1];

      if (currentStep && currentStep.stepType === "tool-call") {
        currentStep.toolResultCount = toolResults.length;
      }

      toolResponses.push(...toolResults);
      context.messages.push(...toProviderMessages(toolResults));
    },
  });

  if (!finalResponse) {
    throw new AssistantError(
      "Agent loop finished without a final response",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const usedTools = steps.some((step) => step.stepType === "tool-call");

  return {
    response: usedTools
      ? {
          ...finalResponse,
          ...(totalUsage ? { usage: totalUsage, totalUsage } : {}),
          steps,
        }
      : totalUsage
        ? { ...finalResponse, usage: totalUsage, totalUsage }
        : finalResponse,
    toolResponses,
  };
}
