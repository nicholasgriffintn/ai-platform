import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import {
  activeToolRules,
  conversationCompactedEvent,
  isAgentExecutionMode,
  type Goal,
  type ResponseEventInput,
  type RunProvenance,
} from "@ngriffin_uk/polychat-schemas";
import { readOptionalString, sleep } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { isAbortError } from "~/infrastructure/abort";
import { resolveServiceContext } from "~/infrastructure/context/serviceContext";
import { closeComposioConnectorRun } from "~/modules/connectors/application/composio-run";
import type { ConversationManager } from "~/modules/conversations/application/manager";
import { SessionManager } from "~/modules/conversations/application/SessionManager";
import {
  acquireThread,
  threadLockError,
  type ThreadLease,
} from "~/modules/conversations/infrastructure/coordinator/client";
import { createGoalService } from "~/modules/goals/application/createGoalService";
import {
  GOAL_STATUS_MARKER_EVENTS,
  recordGoalMarker,
} from "~/modules/goals/application/goalMarker";
import { captureTrainingExample } from "~/modules/model-datasets/application/capture";
import { runAgentLoop } from "~/modules/responses/application/engine/agent/agent-loop";
import { createGoalFinishGate } from "~/modules/responses/application/engine/agent/goal-gate";
import {
  createBufferedTurnTransport,
  createStreamingTurnTransport,
} from "~/modules/responses/application/engine/agent/turn-transport";
import {
  createChatRunReceiptStream,
  createChatTurnStream,
} from "~/modules/responses/application/engine/core/chat-stream";
import { createChatExecutionRequest } from "~/modules/responses/application/engine/core/execution-request";
import { createModelEnsembleStream } from "~/modules/responses/application/engine/core/model-ensemble";
import { buildToolRequestContext } from "~/modules/responses/application/engine/core/request-context";
import { resolveRunProvenance } from "~/modules/responses/application/engine/core/run-provenance";
import { buildChatCompactionMetadata } from "~/modules/responses/application/engine/messages/compaction-metadata";
import { resolveAccountDefaultComputeSite } from "~/modules/responses/application/engine/policy/project-model-tier";
import { resolveTurnStepBudget } from "~/modules/responses/application/engine/policy/step-budget";
import {
  createTierModelFallback,
  type TierModelSelection,
} from "~/modules/responses/application/engine/policy/tier-model-fallback";
import {
  RequestPreparer,
  type PreparedRequest,
} from "~/modules/responses/application/engine/preparation/RequestPreparer";
import { DISCARDING_EVENT_SINK } from "~/modules/responses/application/engine/streaming/emitter";
import { watchTurnCancellation } from "~/modules/responses/application/engine/streaming/turn-cancellation";
import { resolveApprovedToolInteraction } from "~/modules/responses/application/engine/tools/approved-tool-interaction";
import { ValidationPipeline } from "~/modules/responses/application/engine/validation/ValidationPipeline";
import {
  acceptChatRun,
  findAcceptedChatRunCommand,
  type ChatRunLifecycle,
} from "~/modules/responses/application/runs/lifecycle";
import { createPartialCheckpointSink } from "~/modules/responses/application/runs/partial-checkpoint";
import { applyTierReasoningEffort } from "~/modules/responses/domain/tier-reasoning";
import { releaseTeammateComputerAgentLease } from "~/modules/teammates/application/computers";
import type { ChatMode, CoreChatOptions, Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/core/ChatOrchestrator" });

const THREAD_LOCK_RETRY_INTERVAL_MS = 200;
const THREAD_LOCK_RETRY_TIMEOUT_MS = 10_000;

function isStreamingResult(result: unknown): result is { stream: ReadableStream } {
  return (
    typeof result === "object" &&
    result !== null &&
    "stream" in result &&
    (result as { stream?: unknown }).stream instanceof ReadableStream
  );
}

export class ChatOrchestrator {
  private validator: ValidationPipeline;
  private preparer: RequestPreparer;

  constructor(env: any) {
    this.validator = new ValidationPipeline();
    this.preparer = new RequestPreparer(env);
  }

  private async holdThreadForTurn(options: CoreChatOptions): Promise<ThreadLease | undefined> {
    if (!options.completion_id || options.store === false) {
      return undefined;
    }

    const deadline = Date.now() + THREAD_LOCK_RETRY_TIMEOUT_MS;

    for (;;) {
      const lock = await acquireThread({
        env: options.env,
        conversationId: options.completion_id,
        kind: "user_message",
      });

      if (lock.acquired !== false) {
        return lock.lease;
      }

      if (lock.reason !== "busy" || Date.now() >= deadline) {
        throw threadLockError(lock);
      }

      await sleep(THREAD_LOCK_RETRY_INTERVAL_MS);
    }
  }

  private resolveGoalFinishGate(
    chatOptions: CoreChatOptions,
    currentMode: ChatMode,
    conversationManager: ConversationManager,
    goal: Goal | null | undefined,
  ) {
    const user = chatOptions.context?.user;

    if (!user?.id || !hasProEntitlement(user) || !chatOptions.completion_id) {
      return undefined;
    }

    const goalService = createGoalService(chatOptions.context);

    return createGoalFinishGate({
      goalService,
      goal,
      conversationManager,
      surface: isAgentExecutionMode(currentMode) ? "agent" : "chat",
      onTerminalStatus: async (terminalGoal) => {
        await recordGoalMarker({
          conversationManager,
          completionId: chatOptions.completion_id,
          goal: terminalGoal,
          event: GOAL_STATUS_MARKER_EVENTS[terminalGoal.status] ?? "cleared",
        });
      },
    });
  }

  async process(requestOptions: CoreChatOptions) {
    let options = requestOptions;

    try {
      if (!options.compute_site && options.context) {
        const defaultComputeSite = await resolveAccountDefaultComputeSite(options.context);

        if (defaultComputeSite) {
          options = { ...options, compute_site: defaultComputeSite };
        }
      }

      const validationResult = await this.validator.validate(options);

      options = applyTierReasoningEffort(options, validationResult.context.reasoningEffort);

      if (!validationResult?.validation?.isValid) {
        logger.warn("Validation failed", {
          error: validationResult.validation.error,
          type: validationResult.validation.validationType,
          completion_id: options.completion_id,
        });

        if (validationResult.validation.validationType === "auth") {
          throw new AssistantError(
            validationResult.validation.error || "Authentication required",
            validationResult.validation.error === "Missing DB binding"
              ? ErrorType.CONFIGURATION_ERROR
              : ErrorType.AUTHENTICATION_ERROR,
          );
        }

        return {
          selectedModel: validationResult.context.modelConfig?.matchingModel || "unknown",
          validation: validationResult.validation.validationType || "input",
          error: validationResult.validation.error,
          violations: validationResult.validation.violations,
          rawViolations: validationResult.validation.rawViolations,
        };
      }

      const existingRun = await findAcceptedChatRunCommand(options);

      if (existingRun) {
        return {
          duplicateRun: true,
          runReceipt: existingRun.receipt,
          ...(options.stream ? { stream: createChatRunReceiptStream(existingRun.receipt) } : {}),
          selectedModel: validationResult.context.modelConfig?.matchingModel || "unknown",
          completion_id: options.completion_id,
        };
      }

      let threadLease: ThreadLease | undefined;

      try {
        threadLease = await this.holdThreadForTurn(options);
      } catch (error) {
        const racedRun = await findAcceptedChatRunCommand(options);

        if (!racedRun) {
          throw error;
        }

        return {
          duplicateRun: true,
          runReceipt: racedRun.receipt,
          ...(options.stream ? { stream: createChatRunReceiptStream(racedRun.receipt) } : {}),
          selectedModel: validationResult.context.modelConfig?.matchingModel || "unknown",
          completion_id: options.completion_id,
        };
      }

      let runLifecycle: ChatRunLifecycle | null = null;
      let released = false;
      const release = async () => {
        if (!threadLease || released) {
          return;
        }

        released = true;
        await threadLease.release();
      };

      let result: Awaited<ReturnType<typeof this.executeRequest>>;

      try {
        runLifecycle = await acceptChatRun(options);

        if (runLifecycle?.receipt.duplicate) {
          await release();

          return {
            duplicateRun: true,
            runReceipt: runLifecycle.receipt,
            ...(options.stream ? { stream: createChatRunReceiptStream(runLifecycle.receipt) } : {}),
            selectedModel: validationResult.context.modelConfig?.matchingModel || "unknown",
            completion_id: options.completion_id,
          };
        }

        const prepared = await this.preparer.prepare(
          options,
          validationResult.context,
          threadLease,
          runLifecycle?.run.id,
        );

        const runProvenance = resolveRunProvenance({
          requestedSite: options.compute_site,
          model: prepared.primaryModel,
          provider: prepared.primaryProvider,
          modelConfig: prepared.primaryModelConfig,
          teammateId: readOptionalString(options.resolved_configuration?.teammateId),
        });

        await runLifecycle?.recordProvenance(runProvenance);

        const tierSelection = validationResult.context.modelTier
          ? {
              tier: validationResult.context.modelTier,
              attachments: validationResult.context.attachments ?? [],
            }
          : undefined;

        result = await this.executeRequest(
          options,
          prepared,
          release,
          runLifecycle,
          runProvenance,
          tierSelection,
        );
      } catch (error) {
        if (runLifecycle && !runLifecycle.receipt.duplicate) {
          try {
            await runLifecycle.fail(error);
          } catch (runError) {
            logger.error("Failed to record chat run failure", {
              runId: runLifecycle.run.id,
              error: runError,
            });
          }
        }

        await release();

        throw error;
      }

      if (isStreamingResult(result)) {
        return result;
      }

      await release();

      return result;
    } catch (error: any) {
      logger.error("Error in chat orchestration", {
        error,
        completion_id: options.completion_id,
        model: options.model,
      });

      if (error instanceof AssistantError) {
        throw error;
      }

      const errorType = this.determineErrorType(error);
      const errorMessage = this.getErrorMessage(error, errorType);
      const statusCode = error.status || error.statusCode || 500;

      throw new AssistantError(errorMessage, errorType, statusCode);
    }
  }

  private async executeRequest(
    chatOptions: CoreChatOptions,
    prepared: PreparedRequest,
    onTurnEnd?: () => Promise<void>,
    runLifecycle?: ChatRunLifecycle | null,
    runProvenance?: RunProvenance,
    tierSelection?: TierModelSelection,
  ) {
    const {
      platform = "api",
      stream = false,
      store = true,
      enabled_tools: requestedEnabledTools = [],
      approved_tools = [],
    } = chatOptions;
    const startTime = Date.now();

    const {
      modelConfigs,
      primaryModel,
      primaryModelConfig,
      primaryProvider,
      conversationManager,
      messages: preparedMessages,
      systemPrompt,
      messageWithContext,
      toolIntentRequest,
      userSettings,
      currentMode,
      enabledTools = requestedEnabledTools,
    } = prepared;
    const enabled_tools = enabledTools;
    const toolExecutionEnabledTools =
      primaryModelConfig?.agent?.capabilities.reportsApprovals && enabled_tools
        ? [...new Set([...enabled_tools, "request_approval"])]
        : enabled_tools;

    await conversationManager.admitTurn({
      modelConfig: primaryModelConfig,
      messages: preparedMessages,
      skipCreditAdmission: runProvenance?.site !== undefined && runProvenance.site !== "hosted",
    });

    let messages = preparedMessages;
    let didCompact = false;
    let compactionMessage: Message | undefined;

    if (chatOptions.completion_id && messages.length > 0) {
      const sessionManager = new SessionManager({
        env: chatOptions.env,
        conversationManager,
        user: chatOptions.context?.user?.id ? chatOptions.context?.user : undefined,
      });
      const compactedSession = await sessionManager.compact({
        completionId: chatOptions.completion_id,
        messages,
        compaction: chatOptions.compaction,
        mode: currentMode,
        modelConfig: {
          contextWindow: primaryModelConfig?.contextWindow,
        },
      });

      didCompact = compactedSession.compacted;
      compactionMessage = compactedSession.compactionMessage;
      messages = compactedSession.messages;
    }

    const toolRequestContext = buildToolRequestContext({
      chatOptions: {
        ...chatOptions,
        approved_tools,
        enabled_tools: toolExecutionEnabledTools,
        tool_options: prepared.toolOptions,
        conversation_type: prepared.conversationType ?? chatOptions.conversation_type,
        permission_mode: prepared.permissionMode ?? chatOptions.permission_mode,
        options: prepared.requestOptions,
        tool_rules: activeToolRules(userSettings?.tool_rules, chatOptions.acting_rules_suspended),
        settings_disabled_tools: prepared.settingsDisabledTools,
      },
      input: toolIntentRequest,
      mode: currentMode,
      provenance: runProvenance,
      model: primaryModel,
      provider: primaryProvider,
      runId: runLifecycle?.run.id,
      runAttempt: runLifecycle?.run.attempt,
      memoryScope: prepared.memoryScope,
      notebook: prepared.notebook,
    });

    const replayConversationId = chatOptions.completion_id;
    const approvalReplay =
      replayConversationId && runLifecycle
        ? await resolveApprovedToolInteraction({
            conversationId: replayConversationId,
            conversationManager,
            loadMessages: () =>
              conversationManager.getAllMessages(replayConversationId, {
                includeArchived: false,
              }),
            providerMessages: messages,
            request: toolRequestContext,
            run: runLifecycle.run,
          })
        : undefined;

    if (approvalReplay) {
      const updatesById = new Map(approvalReplay.updates.map((message) => [message.id, message]));
      const suppressedMessageIds = new Set(approvalReplay.suppressedMessageIds);

      messages = messages
        .filter((message) => !suppressedMessageIds.has(message.id))
        .map((message) => updatesById.get(message.id) ?? message);
    }

    const continuedRequestOptions = approvalReplay
      ? { ...prepared.requestOptions, toolInteraction: undefined, toolInteractions: undefined }
      : prepared.requestOptions;

    if (approvalReplay) {
      if (!toolRequestContext.request) {
        throw new AssistantError(
          "The approved action lost its request context",
          ErrorType.INTERNAL_ERROR,
        );
      }

      toolRequestContext.request.approved_tools = [];
      toolRequestContext.request.options = continuedRequestOptions ?? {};
    }

    const executionRequest = createChatExecutionRequest({
      chatOptions: {
        ...chatOptions,
        ...(approvalReplay ? { approved_tools: [] } : {}),
        permission_mode: prepared.permissionMode ?? chatOptions.permission_mode,
        settings_disabled_tools: prepared.settingsDisabledTools,
      },
      prepared: {
        ...prepared,
        enabledTools: enabled_tools,
        ...(approvalReplay
          ? {
              messageWithContext: "",
              requestOptions: continuedRequestOptions,
            }
          : {}),
      },
      messages,
      resolvedMaxSteps: resolveTurnStepBudget(chatOptions, currentMode, {
        hasActiveGoal: Boolean(prepared.activeGoal),
      }),
      runId: runLifecycle?.run.id,
    });

    const goalFinishGate = this.resolveGoalFinishGate(
      chatOptions,
      currentMode,
      conversationManager,
      prepared.activeGoal,
    );
    const runParams = {
      requestParams: executionRequest.providerRequest(),
      completionId: chatOptions.completion_id,
      usageScopeId:
        preparedMessages.at(-1)?.id ?? `${chatOptions.completion_id}:${preparedMessages.length}`,
      conversationManager,
      toolRequestContext,
      transport:
        stream || runLifecycle ? createStreamingTurnTransport() : createBufferedTurnTransport(),
      maxSteps: resolveTurnStepBudget(chatOptions, currentMode, {
        hasActiveGoal: Boolean(prepared.activeGoal),
      }),
      env: chatOptions.env,
      model: primaryModel,
      provider: primaryProvider,
      platform: platform || "api",
      mode: currentMode,
      ...(approvalReplay
        ? {
            initialToolCalls: approvalReplay.toolCalls,
            initialToolResults: approvalReplay.toolResults,
          }
        : {}),
      memoryScope: prepared.memoryScope,
      context: chatOptions.context,
      userSettings,
      requestOptions: continuedRequestOptions,
      guardrailPrompt: approvalReplay ? prepared.toolIntentRequest : messageWithContext,
      assessFinish: goalFinishGate
        ? (finishContext) => goalFinishGate.assessFinish(finishContext)
        : undefined,
      onToolResult: goalFinishGate
        ? (toolResult) => goalFinishGate.observeToolResult(toolResult)
        : undefined,
      shouldReserveGoalFinalisation: () =>
        chatOptions.max_steps === undefined && (goalFinishGate?.hasActiveGoal() ?? false),
      executionCtx: chatOptions.executionCtx,
      contextWindow: primaryModelConfig?.contextWindow,
      modelFallback:
        tierSelection &&
        modelConfigs.length === 1 &&
        primaryModelConfig?.kind !== "agent" &&
        runProvenance?.site === "hosted"
          ? createTierModelFallback({
              options: chatOptions,
              selection: tierSelection,
              runLifecycle: runLifecycle ?? null,
              teammateId: runProvenance.teammateId,
            })
          : undefined,
      contextSkills: prepared.contextSkills,
      contextDocuments: prepared.contextDocuments,
      contextSystemSections: prepared.systemPromptSections,
      runId: runLifecycle?.run.id,
      runAttempt: runLifecycle?.run.attempt,
      onContextSnapshot: runLifecycle
        ? (snapshot) => runLifecycle.recordContext(snapshot).then(() => undefined)
        : undefined,
      onRetryState: runLifecycle
        ? (retryState) => runLifecycle.recordRetry(retryState).then(() => undefined)
        : undefined,
      isCancellationRequested: runLifecycle
        ? () => runLifecycle.isCancellationRequested()
        : undefined,
    };

    if (stream) {
      const runsEnsemble = !isAgentExecutionMode(currentMode) && modelConfigs.length > 1;
      const compactionMetadata =
        didCompact && compactionMessage ? buildChatCompactionMetadata(compactionMessage) : null;
      const preludeEvents: ResponseEventInput[] = [
        ...(compactionMetadata ? [conversationCompactedEvent(compactionMetadata.message)] : []),
        ...(chatOptions.stream_prelude_events ?? []),
      ];
      const turnStream = runsEnsemble
        ? createModelEnsembleStream({
            ...runParams,
            models: modelConfigs,
            onTurnEnd,
            runLifecycle,
            preludeEvents,
          })
        : createChatTurnStream({ ...runParams, onTurnEnd, runLifecycle, preludeEvents });

      return {
        stream: turnStream,
        selectedModel: primaryModel,
        ...(runsEnsemble ? { selectedModels: modelConfigs.map((m) => m.model) } : {}),
        completion_id: chatOptions.completion_id,
      };
    }

    let runResult: Awaited<ReturnType<typeof runAgentLoop>>;
    const stopSignal = watchTurnCancellation({
      env: chatOptions.env,
      completionId: chatOptions.completion_id,
      isDetached: () => true,
      isRunCancellationRequested: runLifecycle
        ? () => runLifecycle.isCancellationRequested()
        : undefined,
    });

    const detachedProgressSink = runLifecycle
      ? createPartialCheckpointSink(DISCARDING_EVENT_SINK, (content) =>
          runLifecycle.checkpointPartialContent(content),
        )
      : undefined;

    try {
      runResult = await runAgentLoop({
        ...runParams,
        shouldStop: stopSignal.shouldStop,
        ...(detachedProgressSink ? { sink: detachedProgressSink } : {}),
      });
      await runLifecycle?.complete(runResult);

      try {
        await runResult.postTurn?.();
      } catch (error) {
        logger.error("Failed to finish post-turn work", {
          error,
          completionId: chatOptions.completion_id,
        });
      }
    } finally {
      stopSignal.stop();
      await conversationManager.releaseTurnReservation();

      if (toolRequestContext.context) {
        try {
          await closeComposioConnectorRun(toolRequestContext.context);
        } finally {
          if (chatOptions.teammate_context_id && toolRequestContext.context.executionRunId) {
            await releaseTeammateComputerAgentLease({
              context: toolRequestContext.context,
              contextId: chatOptions.teammate_context_id,
              runId: toolRequestContext.context.executionRunId,
            });
          }
        }
      }
    }

    if (!runResult.guardrailsPassed) {
      return {
        selectedModel: primaryModel,
        validation: "output",
        error: runResult.response.response,
        violations: runResult.guardrailViolations,
        ...(runLifecycle ? { runReceipt: runLifecycle.receipt } : {}),
      };
    }

    if (userSettings?.tracking_enabled) {
      const userMessage = messages.find((m) => m.role === "user");

      if (userMessage && runResult.response.response && store) {
        const context = resolveServiceContext({
          env: chatOptions.env,
          user: chatOptions.context?.user || undefined,
        });

        captureTrainingExample({
          context,
          source: "chat",
          userPrompt:
            typeof userMessage.content === "string"
              ? userMessage.content
              : JSON.stringify(userMessage.content),
          assistantResponse: runResult.response.response,
          systemPrompt,
          modelUsed: primaryModel,
          conversationId: chatOptions.completion_id,
          startTime,
          skipEnhancement: true,
        }).catch((err) => {
          logger.error("Failed to capture training example", err);
        });
      }
    }

    return {
      response: runResult.response,
      toolResponses: runResult.toolResponses,
      selectedModel: primaryModel,
      selectedModels: modelConfigs.length > 1 ? modelConfigs.map((m) => m.model) : undefined,
      completion_id: chatOptions.completion_id,
      ...(compactionMessage ? { compactionMessage } : {}),
      ...(runLifecycle ? { runReceipt: runLifecycle.receipt } : {}),
    };
  }

  private determineErrorType(error: any): ErrorType {
    if (
      error.name === "TimeoutError" ||
      isAbortError(error) ||
      error.code === "ECONNRESET" ||
      error.code === "ECONNABORTED" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ENOTFOUND" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENETUNREACH"
    ) {
      return ErrorType.NETWORK_ERROR;
    }

    if (
      error.status === 429 ||
      error.code === "RATE_LIMIT_EXCEEDED" ||
      error.name === "RateLimitError"
    ) {
      return ErrorType.RATE_LIMIT_ERROR;
    }

    if (
      error.status === 401 ||
      error.status === 403 ||
      error.code === "UNAUTHORIZED" ||
      error.code === "FORBIDDEN" ||
      error.name === "AuthenticationError"
    ) {
      return ErrorType.AUTHENTICATION_ERROR;
    }

    if (
      error.status >= 500 ||
      error.code === "MODEL_ERROR" ||
      error.code === "INVALID_PARAMETER" ||
      error.code === "TOKEN_LIMIT_EXCEEDED" ||
      error.code === "CONTEXT_LENGTH_EXCEEDED" ||
      error.name === "ModelError" ||
      error.name === "ProviderError"
    ) {
      return ErrorType.PROVIDER_ERROR;
    }

    if (error.status >= 400 && error.status < 500) {
      return ErrorType.PARAMS_ERROR;
    }

    return ErrorType.UNKNOWN_ERROR;
  }

  private getErrorMessage(error: any, errorType: ErrorType): string {
    switch (errorType) {
      case ErrorType.NETWORK_ERROR:
        return "Connection error or timeout while communicating with AI provider";
      case ErrorType.RATE_LIMIT_ERROR:
        return "Rate limit exceeded. Please try again later.";
      case ErrorType.AUTHENTICATION_ERROR:
        return "Authentication error with AI provider";
      case ErrorType.PROVIDER_ERROR:
        return error.message || "Error with model parameters or provider";
      default:
        return "An unexpected error occurred";
    }
  }
}
