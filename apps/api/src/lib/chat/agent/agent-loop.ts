import {
  executeAgentLoop,
  controlToolResultContent,
  type AgentEvent,
  type AgentFinishAssessment,
  type AgentLoopState,
  type AgentMessage,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-library-agent-core";

import { finaliseAssistantTurn, type TurnOutput } from "~/lib/chat/agent/assistant-turn";
import { startConversationTitle } from "~/lib/chat/agent/conversation-title";
import { captureRunMemories } from "~/lib/chat/agent/memory-capture";
import { createAgentProviderIO } from "~/lib/chat/agent/provider-io";
import type { ChatTurnTransport } from "~/lib/chat/agent/turn-transport";
import { buildMessageParts } from "~/lib/chat/messages/parts";
import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { DISCARDING_EVENT_SINK, type ChatEventSink } from "~/lib/chat/streaming/emitter";
import { writeTurnActivity } from "~/lib/chat/streaming/turn-activity";
import {
  ARTIFACT_MARKUP_FINAL_ANSWER_NOTICE,
  isArtifactMarkupToolName,
} from "~/lib/chat/tools/artifact-markup";
import { createToolCallLedger, type ToolCallLedger } from "~/lib/chat/tools/call-ledger";
import { getResponseScopedCapabilityToolNames } from "~/lib/chat/tools/capability-activation";
import { isSuccessfulToolStatus } from "~/lib/chat/tools/continuation";
import { emitCompleteToolInput } from "~/lib/chat/tools/events";
import { handleToolCalls } from "~/lib/chat/tools/execution";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { shouldStopTurnForUsage, USAGE_LIMIT_NOTICE } from "~/lib/usage/limitState";
import { sumTokenUsage, type NormalisedTokenUsage } from "~/lib/usage/tokenUsage";
import {
  StreamState,
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
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/agent/agent-loop" });

const AGENT_MAX_RECOVERY_REPLANS = 2;
const AGENT_MAX_TURN_FAILURES = 2;
const DEFAULT_INITIAL_PLAN = "Use available tools as needed, then return a final answer.";
const FINAL_ANSWER_NOTICE =
  "You have used every tool step available for this response. No further tool calls are possible. Answer the user now with what you already have, and say plainly what you could not finish.";
const GOAL_FINALISATION_NOTICE =
  "Resolve the active goal now. Call complete_goal with evidence if it is satisfied, or use ask_user or request_approval if progress is genuinely blocked.";
const REPEATED_TOOL_CALL_NOTICE =
  "The same tool call has already failed with identical arguments. Do not call another tool. Answer the user now with what you have, and say plainly what you could not finish.";
const UNKNOWN_TOOL_FINAL_ANSWER_NOTICE =
  "Another unavailable tool was called after a correction. Do not call another tool. Answer the user now using only the information already available.";

function shouldAbortAgentTurnError(error: unknown): boolean {
  return error instanceof AssistantError && error.type !== ErrorType.PARAMS_ERROR;
}

interface ChatAgentLoopState extends AgentLoopState {
  commandCount: number;
  enabledToolNames: Set<string>;
  unknownToolRecoveryUsed: boolean;
  toolCallLedger: ToolCallLedger;
  pendingUserAction?: { message: string; kind: "approval" | "question" };
  waitingForUserAction?: "approval" | "question";
  streamedToolInputStep?: number;
  stoppedForUsageLimit?: boolean;
  finalAnswerForced?: boolean;
  finalAnswerNotice?: string;
  goalFinalisationRequested?: boolean;
  goalFinalisationNotice?: string;
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
  guardrailPrompt?: string;
  deferOutputUntilValidated?: boolean;
  emit?: (event: AgentEvent) => Promise<void>;
  shouldStop?: () => boolean;
  assessFinish?: (context: {
    summary: string;
    step: number;
    commandCount: number;
    awaitingUserAction?: "approval" | "question";
  }) => Promise<AgentFinishAssessment> | AgentFinishAssessment;
  onToolResult?: (result: Message) => Promise<void> | void;
  shouldReserveGoalFinalisation?: () => boolean;
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
  const titleRun = startConversationTitle({
    completionId: params.completionId,
    conversationManager: params.conversationManager,
    messages: params.requestParams.messages,
    sink,
    context: params.context,
    store: params.requestParams.store,
  });
  const providerIO = createAgentProviderIO();
  const runtimeMessages = providerIO.initialMessages(
    toProviderMessages(params.requestParams.messages),
  );

  const state: ChatAgentLoopState = {
    commandCount: 0,
    enabledToolNames: new Set(params.requestParams.enabled_tools ?? []),
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
    serviceContext: params.context,
    shouldStop: params.shouldStop,
    deferOutputUntilValidated: params.deferOutputUntilValidated,
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
      guardrailPrompt: params.guardrailPrompt,
      deferOutputUntilValidated: params.deferOutputUntilValidated,
    });

    guardrailsPassed = finalised.guardrailsPassed;
    guardrailViolations = finalised.guardrailViolations;
    finalMessage = finalised.message;

    return finalised.message;
  };

  const closingTurn = async (text: string, status?: string) => {
    finalStatus = status;

    if (params.transport.streams && text && !params.deferOutputUntilValidated) {
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
      if (params.shouldReserveGoalFinalisation?.() && !state.goalFinalisationRequested) {
        state.goalFinalisationRequested = true;
        state.goalFinalisationNotice = GOAL_FINALISATION_NOTICE;

        return { extendBy: 2, reason: "Active goal requires a terminal tool result." };
      }

      if (state.finalAnswerForced) {
        return undefined;
      }

      state.finalAnswerNotice ??= FINAL_ANSWER_NOTICE;

      return { extendBy: 1, reason: "Step budget reached; asking for a final answer." };
    },
    getCommandCount: (runtimeState) => runtimeState.commandCount,
    shouldAbortOnTurnError: shouldAbortAgentTurnError,
    assessFinish: params.assessFinish
      ? async ({ summary, step }) => {
          const assessment = state.stoppedForUsageLimit
            ? { allow: true }
            : await params.assessFinish?.({
                summary,
                step,
                commandCount: state.commandCount,
                awaitingUserAction: state.waitingForUserAction,
              });

          return assessment ?? { allow: true };
        }
      : undefined,
    recordControlToolResults: async (toolCalls) => {
      const results = toolCalls.map((toolCall): Message & AgentMessage => {
        const content = controlToolResultContent(toolCall);

        return {
          role: "tool",
          name: toolCall.name,
          content,
          status: "success",
          log_id: "",
          id: generateId(),
          tool_call_id: toolCall.id,
          tool_call_arguments: toolCall.arguments,
          timestamp: Date.now(),
          model: params.model,
          platform: params.platform,
          parts: buildMessageParts({
            role: "tool",
            name: toolCall.name,
            content,
            status: "success",
            tool_call_id: toolCall.id,
            tool_call_arguments: toolCall.arguments,
            timestamp: Date.now(),
          }),
        };
      });

      for (const result of results) {
        await params.conversationManager.add(params.completionId, result);
        await sink.writeEvent("tool_response", {
          tool_id: result.id,
          result,
        });
      }

      toolResponses.push(...results);

      return results;
    },
    resolveTurn: async ({ messages, step }) => {
      if (step > 1 && (await shouldStopTurnForUsage(params.conversationManager))) {
        state.stoppedForUsageLimit = true;

        return closingTurn(USAGE_LIMIT_NOTICE, "usage_limit_reached");
      }

      if (state.pendingUserAction) {
        const pending = state.pendingUserAction;

        state.pendingUserAction = undefined;

        return closingTurn(pending.message, "pending");
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
      const goalFinalisationNotice = state.goalFinalisationNotice;
      const finalAnswerNotice = state.finalAnswerNotice;

      state.goalFinalisationNotice = undefined;

      if (finalAnswerNotice) {
        state.finalAnswerForced = true;
      }

      await writeTurnActivity(sink, { kind: "model_step_started", step });

      let turn: TurnOutput & { error?: unknown };

      try {
        turn = await params.transport.runTurn({
          request: goalFinalisationNotice
            ? {
                ...params.requestParams,
                messages: [...providerMessages, { role: "user", content: goalFinalisationNotice }],
                enabled_tools: [...state.enabledToolNames],
              }
            : finalAnswerNotice
              ? {
                  ...params.requestParams,
                  messages: [...providerMessages, { role: "user", content: finalAnswerNotice }],
                  disable_functions: true,
                  enabled_tools: [...state.enabledToolNames],
                }
              : {
                  ...params.requestParams,
                  messages: providerMessages,
                  enabled_tools: [...state.enabledToolNames],
                },
          sink,
          context: { ...transportContext, step },
        });
      } catch (error) {
        await writeTurnActivity(sink, { kind: "model_step_finished", step, outcome: "failed" });
        throw error;
      }

      if (turn.error) {
        await writeTurnActivity(sink, { kind: "model_step_finished", step, outcome: "failed" });
        throw new AssistantError(resolveProviderErrorMessage(turn.error), ErrorType.PROVIDER_ERROR);
      }

      if (!turn.activityStreamed) {
        if (turn.thinking) {
          await writeTurnActivity(sink, { kind: "reasoning_started", step });
          await writeTurnActivity(sink, { kind: "reasoning_finished", step });
        }

        if (turn.content) {
          await writeTurnActivity(sink, { kind: "response_started", step });
          await writeTurnActivity(sink, { kind: "response_finished", step });
        }
      }

      finalStatus = turn.status ?? finalStatus;
      state.streamedToolInputStep = turn.activityStreamed ? step : undefined;

      totalUsage = sumTokenUsage(totalUsage, turn.usage) ?? totalUsage;

      if (turn.stopped) {
        await writeTurnActivity(sink, { kind: "model_step_finished", step, outcome: "cancelled" });
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

      await writeTurnActivity(sink, {
        kind: "model_step_finished",
        step,
        outcome:
          turn.status === "incomplete"
            ? "failed"
            : turn.toolCalls.length > 0
              ? "tool_calls"
              : "completed",
      });

      const message = await finalise(turn);

      if (!guardrailsPassed) {
        return {
          toolCalls: [],
          text: typeof message.content === "string" ? message.content : "",
          assistantMessage: {
            role: "assistant",
            content: message.content,
          },
        };
      }

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

      if (context.state.streamedToolInputStep !== context.step) {
        await emitToolCallEvents(sink, providerToolCalls as unknown as ToolCall[], context.step);
      }

      await sink.writeEvent("tool_response_start", { tool_calls: providerToolCalls });
      const settledToolCallIds = new Set<string>();

      const toolResults = await handleToolCalls(
        context.shared.completionId,
        { response: "", tool_calls: providerToolCalls },
        context.shared.conversationManager,
        context.shared.toolRequestContext,
        {
          persistResults: "immediate",
          callLedger: context.state.toolCallLedger,
          recoverUnknownToolCalls: !context.state.unknownToolRecoveryUsed,
          onToolExecutionStart: async (tool) => {
            await writeTurnActivity(sink, {
              kind: "tool_execution_started",
              step: context.step,
              toolCallId: tool.id,
              toolName: tool.name,
            });
          },
          onToolResult: async (toolResult) => {
            await sink.writeEvent("tool_response", {
              tool_id: toolResult.id,
              result: toolResult,
            });

            const toolCallId = toolResult.tool_call_id;

            if (typeof toolCallId === "string" && !settledToolCallIds.has(toolCallId)) {
              settledToolCallIds.add(toolCallId);

              if (toolResult.status === "pending") {
                await writeTurnActivity(sink, {
                  kind: "waiting_for_user",
                  step: context.step,
                  toolCallId,
                  toolName: toolResult.name || "unknown",
                  reason: toolResult.name === "ask_user" ? "question" : "approval",
                });
              } else {
                await writeTurnActivity(sink, {
                  kind: "tool_finished",
                  step: context.step,
                  toolCallId,
                  toolName: toolResult.name || "unknown",
                  outcome: isSuccessfulToolStatus(toolResult.status) ? "success" : "failure",
                });
              }
            }

            await params.onToolResult?.(toolResult);
          },
        },
      );

      await sink.writeEvent("tool_response_end", {});
      await emitUsageLimits(sink, context.shared.conversationManager);

      const unknownToolResults = toolResults.filter(
        (message) => message.data?.errorCode === "UNKNOWN_TOOL",
      );

      if (unknownToolResults.length > 0) {
        const recoveryAlreadyUsed = context.state.unknownToolRecoveryUsed;

        context.state.unknownToolRecoveryUsed = true;

        if (unknownToolResults.some((message) => isArtifactMarkupToolName(message.name))) {
          context.state.finalAnswerNotice ??= ARTIFACT_MARKUP_FINAL_ANSWER_NOTICE;
        } else if (recoveryAlreadyUsed || unknownToolResults.length > 1) {
          context.state.finalAnswerNotice ??= UNKNOWN_TOOL_FINAL_ANSWER_NOTICE;
        }
      }

      if (toolResults.some((message) => message.data?.errorCode === "REPEATED_TOOL_CALL")) {
        context.state.finalAnswerNotice ??= REPEATED_TOOL_CALL_NOTICE;
      }

      const activatedToolNames = getResponseScopedCapabilityToolNames(toolResults);

      for (const toolName of activatedToolNames) {
        context.state.enabledToolNames.add(toolName);
      }

      if (activatedToolNames.length > 0 && context.shared.toolRequestContext.request) {
        context.shared.toolRequestContext.request.enabled_tools = [
          ...context.state.enabledToolNames,
        ];
      }

      context.state.commandCount += toolResults.filter((message) =>
        isSuccessfulToolStatus(message.status),
      ).length;

      const pendingResult = toolResults.find((message) => message.status === "pending");

      if (pendingResult) {
        const kind = pendingResult.name === "ask_user" ? "question" : "approval";

        context.state.waitingForUserAction = kind;
        context.state.pendingUserAction = {
          kind,
          message:
            typeof pendingResult.content === "string" && pendingResult.content.trim()
              ? pendingResult.content
              : kind === "question"
                ? "This work is waiting for your answer."
                : "This action is waiting for user approval.",
        };
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

  const title = await titleRun.complete(finalMessage);

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

async function emitToolCallEvents(
  sink: ChatEventSink,
  toolCalls: readonly ToolCall[],
  step: number,
) {
  for (const toolCall of toolCalls) {
    try {
      await emitCompleteToolInput(sink, step, toolCall);
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
