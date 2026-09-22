import {
  applyReportedContextUsage,
  controlToolResultContent,
  executeAgentLoop,
  fitMessagesToContextBudget,
  type AgentEvent,
  type ContextBudgetSkill,
  type AgentFinishAssessment,
  type AgentLoopState,
  type AgentMessage,
  type AgentToolCall,
} from "@ngriffin_uk/polychat-ai-agents";
import { getPromptText } from "@ngriffin_uk/polychat-ai-prompts";
import { extractTextFromMessageContent } from "@ngriffin_uk/polychat-ai-providers";
import {
  sumTokenUsage,
  type NormalisedTokenUsage,
  getLogger,
} from "@ngriffin_uk/polychat-ai-telemetry";
import type {
  ChatContextDocument,
  ChatContextSnapshot,
  ChatRetrySnapshot,
  RunProvenance,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { generateId } from "@ngriffin_uk/polychat-utility-server/id";
import {
  readRecordObjectField,
  readStringField,
} from "@ngriffin_uk/polychat-utility-server/record-fields";
import { isRetryCancelledError } from "@ngriffin_uk/polychat-utility-server/retries";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  finaliseAssistantTurn,
  type TurnOutput,
} from "~/modules/chat/application/agent/assistant-turn";
import { startConversationTitle } from "~/modules/chat/application/agent/conversation-title";
import { captureRunMemories } from "~/modules/chat/application/agent/memory-capture";
import { createAgentProviderIO } from "~/modules/chat/application/agent/provider-io";
import type { ChatTurnTransport } from "~/modules/chat/application/agent/turn-transport";
import { buildMessageParts } from "~/modules/chat/application/messages/parts";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import {
  DISCARDING_EVENT_SINK,
  type ChatEventSink,
} from "~/modules/chat/application/streaming/emitter";
import { createStreamedToolResultEvent } from "~/modules/chat/application/streaming/tool-result-preview";
import { writeTurnActivity } from "~/modules/chat/application/streaming/turn-activity";
import {
  ARTIFACT_MARKUP_FINAL_ANSWER_NOTICE,
  isArtifactMarkupToolName,
} from "~/modules/chat/application/tools/artifact-markup";
import {
  createToolCallLedger,
  type ToolCallLedger,
} from "~/modules/chat/application/tools/call-ledger";
import { getResponseScopedCapabilityToolNames } from "~/modules/chat/application/tools/capability-activation";
import { isSuccessfulToolStatus } from "~/modules/chat/application/tools/continuation";
import { emitCompleteToolInput } from "~/modules/chat/application/tools/events";
import { handleToolCalls } from "~/modules/chat/application/tools/execution";
import { createProviderRetryBudget } from "~/modules/chat/domain/provider-retry";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import { listFunctionToolDefinitions } from "~/modules/functions/application/definitions";
import { shouldStopTurnForUsage, USAGE_LIMIT_NOTICE } from "~/modules/usage/application/limitState";
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

const logger = getLogger({ prefix: "services/chat/agent/agent-loop" });

const AGENT_MAX_RECOVERY_REPLANS = 2;
const AGENT_MAX_TURN_FAILURES = 2;
const MAX_PROVIDER_RETRIES_PER_RUN = 2;
const DEFAULT_INITIAL_PLAN = "Use available tools as needed, then return a final answer.";
const FINAL_ANSWER_NOTICE = getPromptText("apps/agent-loop/final-answer");
const GOAL_FINALISATION_NOTICE = getPromptText("apps/agent-loop/goal-finalisation");
const REPEATED_TOOL_CALL_NOTICE = getPromptText("apps/agent-loop/repeated-tool-call");
const UNKNOWN_TOOL_FINAL_ANSWER_NOTICE = getPromptText("apps/agent-loop/unknown-tool-final-answer");

function waitingForUserReason(result: Message): "approval" | "question" | "selection" | "takeover" {
  const humanInTheLoop = readRecordObjectField(result.data, "humanInTheLoop");
  const interactionType = readStringField(humanInTheLoop, "type");

  if (interactionType === "selection") {
    return "selection";
  }

  if (interactionType === "takeover") {
    return "takeover";
  }

  if (interactionType === "question") {
    return "question";
  }

  return "approval";
}

function shouldAbortAgentTurnError(error: unknown): boolean {
  return error instanceof AssistantError && error.type !== ErrorType.PARAMS_ERROR;
}

interface ChatAgentLoopState extends AgentLoopState {
  commandCount: number;
  enabledToolNames: Set<string>;
  unknownToolRecoveryUsed: boolean;
  toolCallLedger: ToolCallLedger;
  pendingUserAction?: {
    message: string;
    kind: "approval" | "question" | "takeover";
  };
  waitingForUserAction?: "approval" | "question" | "takeover";
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
  provenance?: RunProvenance;
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
  emit?: (event: AgentEvent) => Promise<void>;
  shouldStop?: () => boolean;
  isCancellationRequested?: () => Promise<boolean>;
  assessFinish?: (context: {
    summary: string;
    step: number;
    commandCount: number;
    awaitingUserAction?: "approval" | "question" | "takeover";
  }) => Promise<AgentFinishAssessment> | AgentFinishAssessment;
  onToolResult?: (result: Message) => Promise<void> | void;
  shouldReserveGoalFinalisation?: () => boolean;
  contextWindow?: number;
  contextSkills?: readonly ContextBudgetSkill[];
  contextDocuments?: readonly ChatContextDocument[];
  runId?: string;
  runAttempt?: number;
  provenance?: RunProvenance;
  onContextSnapshot?: (snapshot: ChatContextSnapshot) => Promise<void> | void;
  onRetryState?: (state: ChatRetrySnapshot | null) => Promise<void> | void;
}

export interface AgentLoopPostTurnResult {
  memoryMessages: Message[];
  conversationTitle?: string;
}

export interface AgentLoopExecutionResult {
  response: ModelResponse;
  conversationTitle?: string;
  finalMessage?: Message;
  toolResponses: Message[];
  memoryMessages: Message[];
  guardrailsPassed: boolean;
  guardrailViolations: unknown[];
  pendingInteractionKind?: "question" | "approval" | "takeover";
  postTurn?: () => Promise<AgentLoopPostTurnResult>;
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
  const platformToolNames = new Set(listFunctionToolDefinitions().map((tool) => tool.name));
  const callerToolNames = new Set(
    params.requestParams.tools
      ?.map((tool) => tool.function.name)
      .filter((name) => !platformToolNames.has(name)),
  );
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
  const providerRetryBudget = createProviderRetryBudget(MAX_PROVIDER_RETRIES_PER_RUN);

  const shouldStop = async () =>
    params.shouldStop?.() === true || (await params.isCancellationRequested?.()) === true;

  const transportContext = {
    env: params.env,
    completionId: params.completionId,
    model: params.model,
    provider: params.provider,
    userId: params.context?.user?.id,
    serviceContext: params.context,
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
      guardrailPrompt: params.guardrailPrompt,
      runId: params.runId,
      runAttempt: params.runAttempt,
      provenance: params.provenance,
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
      if (params.shouldReserveGoalFinalisation?.() && !state.goalFinalisationRequested) {
        state.goalFinalisationRequested = true;
        state.goalFinalisationNotice = GOAL_FINALISATION_NOTICE;

        return {
          extendBy: 2,
          reason: "Active goal requires a terminal tool result.",
        };
      }

      if (state.finalAnswerForced) {
        return undefined;
      }

      state.finalAnswerNotice ??= FINAL_ANSWER_NOTICE;

      return {
        extendBy: 1,
        reason: "Step budget reached; asking for a final answer.",
      };
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
        await sink.writeEvent("tool_response", createStreamedToolResultEvent(result));
      }

      toolResponses.push(...results);

      return results;
    },
    resolveTurn: async ({ messages, step }) => {
      if (await shouldStop()) {
        return closingTurn("", "stopped");
      }

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

      const goalFinalisationNotice = state.goalFinalisationNotice;
      const finalAnswerNotice = state.finalAnswerNotice;

      state.goalFinalisationNotice = undefined;

      if (finalAnswerNotice) {
        state.finalAnswerForced = true;
      }

      const budgetMessages = goalFinalisationNotice
        ? [
            ...messages,
            {
              role: "user" as const,
              content: goalFinalisationNotice,
              data: { contextControl: true },
            },
          ]
        : finalAnswerNotice
          ? [
              ...messages,
              {
                role: "user" as const,
                content: finalAnswerNotice,
                data: { contextControl: true },
              },
            ]
          : messages;

      const contextBudget = fitMessagesToContextBudget({
        messages: budgetMessages,
        contextWindow: params.contextWindow,
        systemPrompt:
          typeof params.requestParams.system_prompt === "string"
            ? params.requestParams.system_prompt
            : "",
        maxOutputTokens: params.requestParams.max_tokens,
        runId: params.runId ?? params.completionId,
        conversationId: params.completionId,
        attempt: params.runAttempt ?? 1,
        step,
        model: params.model,
        provider: params.provider,
        skills: params.contextSkills,
        documents: params.contextDocuments,
      });

      await params.onContextSnapshot?.(contextBudget.snapshot);

      const providerMessages = providerIO.providerMessages(contextBudget.messages);

      await writeTurnActivity(sink, { kind: "model_step_started", step });

      let turn: TurnOutput & { error?: unknown };

      try {
        turn = await params.transport.runTurn({
          request: goalFinalisationNotice
            ? {
                ...params.requestParams,
                messages: providerMessages,
                enabled_tools: [...state.enabledToolNames],
              }
            : finalAnswerNotice
              ? {
                  ...params.requestParams,
                  messages: providerMessages,
                  disable_functions: true,
                  enabled_tools: [...state.enabledToolNames],
                }
              : {
                  ...params.requestParams,
                  messages: providerMessages,
                  enabled_tools: [...state.enabledToolNames],
                },
          sink,
          context: {
            ...transportContext,
            step,
            retry: providerRetryBudget.forStep(step, {
              shouldStop: params.shouldStop,
              onStateChange: params.onRetryState,
            }),
          },
        });
      } catch (error) {
        if (isRetryCancelledError(error) || params.shouldStop?.()) {
          await writeTurnActivity(sink, {
            kind: "model_step_finished",
            step,
            outcome: "cancelled",
          });

          return closingTurn("", "stopped");
        }

        await writeTurnActivity(sink, {
          kind: "model_step_finished",
          step,
          outcome: "failed",
        });
        throw error;
      }

      if (turn.error) {
        await writeTurnActivity(sink, {
          kind: "model_step_finished",
          step,
          outcome: "failed",
        });
        throw new AssistantError(resolveProviderErrorMessage(turn.error), ErrorType.PROVIDER_ERROR);
      }

      if (await shouldStop()) {
        return closingTurn("", "stopped");
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

      await params.onContextSnapshot?.(
        applyReportedContextUsage(contextBudget.snapshot, turn.usage?.input_tokens),
      );

      if (turn.stopped) {
        await writeTurnActivity(sink, {
          kind: "model_step_finished",
          step,
          outcome: "cancelled",
        });
        finalStatus = "stopped";

        if (!turn.content) {
          return {
            toolCalls: [],
            text: "",
            assistantMessage: { role: "assistant", content: "" },
          };
        }

        const stoppedMessage = await finalise({
          ...turn,
          toolCalls: [],
          status: "stopped",
        });

        return {
          toolCalls: [],
          text: turn.content,
          assistantMessage: {
            role: "assistant",
            content: stoppedMessage.content,
          },
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
        toolCalls:
          hasToolCalls && !turn.toolCalls.some((tool) => callerToolNames.has(tool.function.name))
            ? providerIO.agentToolCalls(turn.toolCalls)
            : [],
        text: turn.content,
        assistantMessage: {
          role: "assistant",
          content: message.content,
          ...(hasToolCalls ? { tool_calls: turn.toolCalls } : {}),
        },
      };
    },
    executeToolCalls: async (toolCalls: AgentToolCall[], context) => {
      if (await shouldStop()) {
        return;
      }

      const providerToolCalls = providerIO.providerToolCalls(toolCalls);

      if (context.state.streamedToolInputStep !== context.step) {
        await emitToolCallEvents(sink, providerToolCalls as unknown as ToolCall[], context.step);
      }

      await sink.writeEvent("tool_response_start", {
        tool_calls: providerToolCalls,
      });
      const settledToolCallIds = new Set<string>();

      const toolResults = await handleToolCalls(
        context.shared.completionId,
        { response: "", tool_calls: providerToolCalls },
        context.shared.conversationManager,
        context.shared.toolRequestContext,
        {
          persistResults: "immediate",
          isExecutionAllowed: async () => !(await shouldStop()),
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
            await sink.writeEvent("tool_response", createStreamedToolResultEvent(toolResult));

            const toolCallId = toolResult.tool_call_id;

            if (typeof toolCallId === "string" && !settledToolCallIds.has(toolCallId)) {
              settledToolCallIds.add(toolCallId);

              if (toolResult.status === "pending") {
                await writeTurnActivity(sink, {
                  kind: "waiting_for_user",
                  step: context.step,
                  toolCallId,
                  toolName: toolResult.name || "unknown",
                  reason: waitingForUserReason(toolResult),
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
        const reason = waitingForUserReason(pendingResult);
        const kind =
          reason === "takeover" ? "takeover" : reason === "approval" ? "approval" : "question";

        context.state.waitingForUserAction = kind;
        context.state.pendingUserAction = {
          kind,
          message:
            typeof pendingResult.content === "string" && pendingResult.content.trim()
              ? pendingResult.content
              : reason === "selection"
                ? "This work is waiting for your selection."
                : kind === "question"
                  ? "This work is waiting for your answer."
                  : kind === "takeover"
                    ? "This work is waiting for you to take control."
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

  const completedMessage = finalMessage;
  const memoryMessages: Message[] = [];
  const usedTools = steps.some((step) => step.stepType === "tool-call");

  const postTurn = async (): Promise<AgentLoopPostTurnResult> => {
    const [capturedMemories, title] = await Promise.all([
      captureRunMemories({
        env: params.env,
        completionId: params.completionId,
        conversationManager: params.conversationManager,
        context: params.context,
        userSettings: params.userSettings,
        memoryScope: params.memoryScope,
        model: params.model,
        platform: params.platform,
        toolCalls: allToolCalls,
        store: params.requestParams.store === true,
        trustedUserInput:
          params.requestParams.trigger === undefined || params.requestParams.trigger === "user",
      }),
      titleRun.complete(completedMessage),
    ]);

    memoryMessages.push(...capturedMemories);

    for (const memoryMessage of capturedMemories) {
      await sink.writeEvent("tool_response", createStreamedToolResultEvent(memoryMessage));
    }

    return {
      memoryMessages: capturedMemories,
      ...(title ? { conversationTitle: title } : {}),
    };
  };

  return {
    response: {
      response:
        typeof completedMessage.content === "string"
          ? completedMessage.content
          : extractTextFromMessageContent(completedMessage.content),
      citations: completedMessage.citations ?? null,
      data: completedMessage.data,
      log_id: completedMessage.log_id,
      tool_calls: completedMessage.tool_calls ?? null,
      status: finalStatus,
      ...(completedMessage.provenance ? { provenance: completedMessage.provenance } : {}),
      ...(totalUsage ? { usage: totalUsage, totalUsage } : {}),
      ...(usedTools ? { steps } : {}),
    },
    finalMessage: completedMessage,
    toolResponses,
    memoryMessages,
    guardrailsPassed,
    guardrailViolations,
    ...(state.waitingForUserAction ? { pendingInteractionKind: state.waitingForUserAction } : {}),
    postTurn,
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
