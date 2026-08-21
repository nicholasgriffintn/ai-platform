import {
  executeAgentLoop,
  type AgentEvent,
  type AgentFinishAssessment,
  type AgentLoopState,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";

import { finaliseAssistantTurn, type TurnOutput } from "~/lib/chat/agent/assistant-turn";
import { ensureConversationTitle } from "~/lib/chat/agent/conversation-title";
import { captureRunMemories } from "~/lib/chat/agent/memory-capture";
import { createAgentProviderIO } from "~/lib/chat/agent/provider-io";
import type { ChatTurnTransport } from "~/lib/chat/agent/turn-transport";
import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { DISCARDING_EVENT_SINK, type ChatEventSink } from "~/lib/chat/streaming/emitter";
import { createToolCallLedger, type ToolCallLedger } from "~/lib/chat/tools/call-ledger";
import { isSuccessfulToolStatus } from "~/lib/chat/tools/continuation";
import { getToolEventPayload } from "~/lib/chat/tools/events";
import { handleToolCalls } from "~/lib/chat/tools/execution";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { isUsageExhausted, USAGE_LIMIT_NOTICE } from "~/lib/usage/limitState";
import { sumTokenUsage, type NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import {
  StreamState,
  ToolStage,
  type ChatCompletionParameters,
  type ChatMode,
  type ChatRequestOptions,
  type IEnv,
  type IRequest,
  type IUserSettings,
  type MemoryScope,
  type Message,
  type Platform,
  type ToolCall,
} from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/agent/agent-loop" });

const AGENT_MAX_RECOVERY_REPLANS = 2;
const AGENT_MAX_TURN_FAILURES = 2;
const DEFAULT_INITIAL_PLAN = "Use available tools as needed, then return a final answer.";
const FINAL_ANSWER_NOTICE =
  "You have used every tool step available for this response. No further tool calls are possible. Answer the user now with what you already have, and say plainly what you could not finish.";

function shouldAbortAgentTurnError(error: unknown): boolean {
  return error instanceof AssistantError && error.type !== ErrorType.PARAMS_ERROR;
}

interface ChatAgentLoopState extends AgentLoopState {
  commandCount: number;
  unknownToolRecoveryUsed: boolean;
  toolCallLedger: ToolCallLedger;
  pendingUserAction?: string;
  stoppedForUsageLimit?: boolean;
  finalAnswerForced?: boolean;
}

interface ChatAgentSharedContext {
  completionId: string;
  conversationManager: ConversationManager;
  toolRequestContext: IRequest;
}

export interface AgentStepSummary {
  stepNumber: number;
  stepType: "tool-call" | "final";
  toolCallCount: number;
  toolResultCount: number;
  usage?: NormalisedTokenUsage;
}

export interface ModelResponse {
  response?: string;
  tool_calls?: Record<string, unknown>[] | null;
  citations?: string[] | null;
  data?: unknown;
  log_id?: string;
  usage?: NormalisedTokenUsage;
  usageMetadata?: NormalisedTokenUsage;
  totalUsage?: NormalisedTokenUsage;
  refusal?: string | null;
  annotations?: unknown;
  status?: string;
  steps?: AgentStepSummary[];
}

export interface AgentLoopExecutionParams {
  requestParams: ChatCompletionParameters;
  completionId: string;
  conversationManager: ConversationManager;
  toolRequestContext: IRequest;
  transport: ChatTurnTransport;
  maxSteps: number;
  env: IEnv;
  model: string;
  provider: string;
  platform: Platform;
  mode: ChatMode;
  memoryScope: MemoryScope;
  sink?: ChatEventSink;
  context?: ServiceContext;
  userSettings?: IUserSettings;
  requestOptions?: ChatRequestOptions;
  emit?: (event: AgentEvent) => Promise<void>;
  shouldStop?: () => boolean;
  assessFinish?: (context: {
    summary: string;
    step: number;
    commandCount: number;
  }) => Promise<AgentFinishAssessment> | AgentFinishAssessment;
}

export interface AgentLoopExecutionResult {
  response: ModelResponse;
  conversationTitle?: string;
  finalMessage?: Message;
  toolResponses: Message[];
  memoryMessages: Message[];
  guardrailsPassed: boolean;
  guardrailViolations: unknown[];
}

export async function runAgentLoop(
  params: AgentLoopExecutionParams,
): Promise<AgentLoopExecutionResult> {
  const sink = params.sink ?? DISCARDING_EVENT_SINK;
  const providerIO = createAgentProviderIO();
  const runtimeMessages = providerIO.initialMessages(
    toProviderMessages(params.requestParams.messages),
  );

  const state: ChatAgentLoopState = {
    commandCount: 0,
    unknownToolRecoveryUsed: false,
    toolCallLedger: createToolCallLedger(),
  };
  const toolResponses: Message[] = [];
  const allToolCalls: ToolCall[] = [];
  const steps: AgentStepSummary[] = [];

  let totalUsage: NormalisedTokenUsage | undefined;
  let finalMessage: Message | undefined;
  let finalStatus: string | undefined;
  let guardrailsPassed = true;
  let guardrailViolations: unknown[] = [];

  const transportContext = {
    env: params.env,
    completionId: params.completionId,
    model: params.model,
    provider: params.provider,
    userId: params.context?.user?.id,
    shouldStop: params.shouldStop,
  };

  const finalise = async (turn: TurnOutput) => {
    await sink.writeEvent("state", { state: StreamState.POST_PROCESSING });

    const finalised = await finaliseAssistantTurn({
      turn,
      sink,
      conversationManager: params.conversationManager,
      completionId: params.completionId,
      env: params.env,
      model: params.model,
      provider: params.provider,
      platform: params.platform,
      mode: params.mode,
      context: params.context,
      userSettings: params.userSettings,
      requestOptions: params.requestOptions,
    });

    guardrailsPassed = finalised.guardrailsPassed;
    guardrailViolations = finalised.guardrailViolations;
    finalMessage = finalised.message;

    return finalised.message;
  };

  const closingTurn = async (text: string, status?: string) => {
    finalStatus = status;

    if (params.transport.streams && text) {
      await sink.writeEvent("content_block_delta", { content: text });
    }

    await finalise({ content: text, toolCalls: [], status });

    return {
      toolCalls: [],
      text,
      assistantMessage: { role: "assistant" as const, content: text },
    };
  };

  await executeAgentLoop<ChatAgentSharedContext, ChatAgentLoopState>({
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
    onStepBudgetExceeded: () => {
      if (state.finalAnswerForced) {
        return undefined;
      }

      state.finalAnswerForced = true;

      return { extendBy: 1, reason: "Step budget reached; asking for a final answer." };
    },
    getCommandCount: (runtimeState) => runtimeState.commandCount,
    shouldAbortOnTurnError: shouldAbortAgentTurnError,
    assessFinish: params.assessFinish
      ? ({ summary, step }) =>
          state.stoppedForUsageLimit
            ? { allow: true }
            : params.assessFinish({ summary, step, commandCount: state.commandCount })
      : undefined,
    resolveTurn: async ({ messages, step }) => {
      if (step > 1 && (await isUsageExhausted(params.conversationManager))) {
        state.stoppedForUsageLimit = true;

        return closingTurn(USAGE_LIMIT_NOTICE, "usage_limit_reached");
      }

      if (state.pendingUserAction) {
        const pending = state.pendingUserAction;

        state.pendingUserAction = undefined;

        return closingTurn(pending, "pending");
      }

      await sink.writeEvent("message_start", {
        id: params.completionId,
        created: Date.now(),
        model: params.model,
        provider: params.provider,
        platform: params.platform,
      });
      await sink.writeEvent("state", { state: StreamState.THINKING });

      const providerMessages = providerIO.providerMessages(messages);
      const turn = await params.transport.runTurn({
        request: state.finalAnswerForced
          ? {
              ...params.requestParams,
              messages: [...providerMessages, { role: "user", content: FINAL_ANSWER_NOTICE }],
              disable_functions: true,
            }
          : { ...params.requestParams, messages: providerMessages },
        sink,
        context: transportContext,
      });

      if (turn.error) {
        throw new AssistantError(resolveProviderErrorMessage(turn.error), ErrorType.PROVIDER_ERROR);
      }

      totalUsage = sumTokenUsage(totalUsage, turn.usage) ?? totalUsage;

      if (turn.stopped) {
        finalStatus = "stopped";

        if (!turn.content) {
          return {
            toolCalls: [],
            text: "",
            assistantMessage: { role: "assistant", content: "" },
          };
        }

        const stoppedMessage = await finalise({ ...turn, toolCalls: [], status: "stopped" });

        return {
          toolCalls: [],
          text: turn.content,
          assistantMessage: { role: "assistant", content: stoppedMessage.content },
        };
      }

      const message = await finalise(turn);
      const hasToolCalls = turn.toolCalls.length > 0;

      steps.push({
        stepNumber: steps.length + 1,
        stepType: hasToolCalls ? "tool-call" : "final",
        toolCallCount: turn.toolCalls.length,
        toolResultCount: 0,
        ...(turn.usage ? { usage: turn.usage } : {}),
      });

      if (hasToolCalls) {
        allToolCalls.push(...turn.toolCalls);
      }

      return {
        toolCalls: hasToolCalls ? providerIO.agentToolCalls(turn.toolCalls) : [],
        text: turn.content,
        assistantMessage: {
          role: "assistant",
          content: message.content,
          ...(hasToolCalls ? { tool_calls: turn.toolCalls } : {}),
        },
      };
    },
    executeToolCalls: async (toolCalls: AgentToolCall[], context) => {
      const providerToolCalls = providerIO.providerToolCalls(toolCalls);

      await emitToolCallEvents(sink, providerToolCalls as unknown as ToolCall[]);
      await sink.writeEvent("tool_response_start", { tool_calls: providerToolCalls });

      const toolResults = await handleToolCalls(
        context.shared.completionId,
        { response: "", tool_calls: providerToolCalls },
        context.shared.conversationManager,
        context.shared.toolRequestContext,
        {
          persistResults: "immediate",
          callLedger: context.state.toolCallLedger,
          recoverUnknownToolCalls: !context.state.unknownToolRecoveryUsed,
          onToolResult: async (toolResult) => {
            await sink.writeEvent("tool_response", {
              tool_id: toolResult.id,
              result: toolResult,
            });
          },
        },
      );

      await sink.writeEvent("tool_response_end", {});
      await emitUsageLimits(sink, context.shared.conversationManager);

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

      if (currentStep?.stepType === "tool-call") {
        currentStep.toolResultCount = toolResults.length;
      }

      toolResponses.push(...toolResults);
      context.messages.push(...toProviderMessages(toolResults));
    },
  });

  if (!finalMessage) {
    throw new AssistantError(
      "Agent loop finished without a final response",
      ErrorType.PROVIDER_ERROR,
    );
  }

  const memoryMessages = await captureRunMemories({
    env: params.env,
    completionId: params.completionId,
    conversationManager: params.conversationManager,
    context: params.context,
    userSettings: params.userSettings,
    memoryScope: params.memoryScope,
    model: params.model,
    platform: params.platform,
    toolCalls: allToolCalls,
  });

  for (const memoryMessage of memoryMessages) {
    await sink.writeEvent("tool_response", {
      tool_id: memoryMessage.id,
      result: memoryMessage,
    });
  }

  const title = await ensureConversationTitle({
    completionId: params.completionId,
    conversationManager: params.conversationManager,
    context: params.context,
    store: params.requestParams.store,
  });

  if (title) {
    await sink.writeEvent("state", { state: "conversation_title", title });
  }

  const usedTools = steps.some((step) => step.stepType === "tool-call");

  return {
    response: {
      response: typeof finalMessage.content === "string" ? finalMessage.content : "",
      citations: finalMessage.citations ?? null,
      data: finalMessage.data,
      log_id: finalMessage.log_id,
      tool_calls: finalMessage.tool_calls ?? null,
      status: finalStatus,
      ...(totalUsage ? { usage: totalUsage, totalUsage } : {}),
      ...(usedTools ? { steps } : {}),
    },
    finalMessage,
    ...(title ? { conversationTitle: title } : {}),
    toolResponses,
    memoryMessages,
    guardrailsPassed,
    guardrailViolations,
  };
}

async function emitToolCallEvents(sink: ChatEventSink, toolCalls: readonly ToolCall[]) {
  for (const toolCall of toolCalls) {
    try {
      await sink.writeEvent("tool_use_start", getToolEventPayload(toolCall, ToolStage.START));
      await sink.writeEvent(
        "tool_use_delta",
        getToolEventPayload(toolCall, ToolStage.DELTA, toolCall.function?.arguments || "{}"),
      );
      await sink.writeEvent("tool_use_stop", getToolEventPayload(toolCall, ToolStage.STOP));
    } catch (error) {
      logger.error("Failed to emit tool events", { error, toolCall });
    }
  }
}

async function emitUsageLimits(sink: ChatEventSink, conversationManager: ConversationManager) {
  try {
    const usageLimits = await conversationManager.getUsageLimits();

    if (usageLimits) {
      await sink.writeEvent("usage_limits", { usage_limits: usageLimits });
    }
  } catch (error) {
    logger.error("Failed to read updated usage limits", {
      error_message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

function resolveProviderErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  const message = (error as { message?: unknown })?.message;

  return typeof message === "string" ? message : "The model provider returned an error";
}
