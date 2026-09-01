import type { Goal } from "@ngriffin_uk/polychat-schemas";

import { runAgentLoop } from "~/lib/chat/agent/agent-loop";
import { createGoalFinishGate } from "~/lib/chat/agent/goal-gate";
import {
  createBufferedTurnTransport,
  createStreamingTurnTransport,
} from "~/lib/chat/agent/turn-transport";
import { createChatTurnStream } from "~/lib/chat/core/chat-stream";
import { prependCompactionStateEvent } from "~/lib/chat/core/compaction-stream";
import { createChatExecutionRequest } from "~/lib/chat/core/execution-request";
import { createModelEnsembleStream } from "~/lib/chat/core/model-ensemble";
import { buildToolRequestContext } from "~/lib/chat/core/request-context";
import { pruneMessagesToFitContext } from "~/lib/chat/policy/context-window";
import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import { resolveTurnStepBudget } from "~/lib/chat/policy/step-budget";
import { RequestPreparer, type PreparedRequest } from "~/lib/chat/preparation/RequestPreparer";
import { ValidationPipeline } from "~/lib/chat/validation/ValidationPipeline";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { captureTrainingExample } from "~/lib/providers/capabilities/training/captureTrainingExample";
import { SessionManager } from "~/lib/session/SessionManager";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import { acquireThread, releaseThread } from "~/services/conversations/coordinator/client";
import { disposeMCPClients } from "~/services/functions/mcp";
import { GOAL_STATUS_MARKER_EVENTS, recordGoalMarker } from "~/services/goals/goalMarker";
import { GoalService } from "~/services/goals/GoalService";
import type { ChatMode, CoreChatOptions, Message } from "~/types";
import { isAbortError } from "~/utils/abort";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/ChatOrchestrator" });

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

  private async holdThreadForTurn(options: CoreChatOptions): Promise<boolean> {
    if (!options.completion_id || options.store === false) {
      return false;
    }

    const lock = await acquireThread({
      env: options.env,
      conversationId: options.completion_id,
      kind: "user_message",
    });

    if (!lock.acquired) {
      throw new AssistantError(
        "This conversation is already working on something. Try again once it finishes.",
        ErrorType.CONFLICT_ERROR,
      );
    }

    return true;
  }

  private resolveGoalFinishGate(
    chatOptions: CoreChatOptions,
    currentMode: ChatMode,
    conversationManager: ConversationManager,
    goal: Goal | null | undefined,
  ) {
    const user = chatOptions.context?.user;

    if (!user?.id || user.plan_id !== "pro" || !chatOptions.completion_id) {
      return undefined;
    }

    const goalService = new GoalService(chatOptions.context.repositories.goals);

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

  async process(options: CoreChatOptions) {
    try {
      const validationResult = await this.validator.validate(options);

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

      const heldThread = await this.holdThreadForTurn(options);
      let released = false;
      const release = async () => {
        if (!heldThread || released) {
          return;
        }

        released = true;

        await releaseThread({
          env: options.env,
          conversationId: options.completion_id,
        });
      };

      let result: Awaited<ReturnType<typeof this.executeRequest>>;

      try {
        const prepared = await this.preparer.prepare(options, validationResult.context);

        result = await this.executeRequest(options, prepared, release);
      } catch (error) {
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
      userSettings,
      currentMode,
      enabledTools = requestedEnabledTools,
    } = prepared;
    const enabled_tools = enabledTools;

    await conversationManager.admitTurn({
      modelConfig: primaryModelConfig,
      messages: preparedMessages,
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

    messages = pruneMessagesToFitContext(messages, messageWithContext, primaryModelConfig);
    const executionRequest = createChatExecutionRequest({
      chatOptions,
      prepared: {
        ...prepared,
        enabledTools: enabled_tools,
      },
      messages,
      resolvedMaxSteps: resolveTurnStepBudget(chatOptions, currentMode, {
        hasActiveGoal: Boolean(prepared.activeGoal),
      }),
    });

    const toolRequestContext = buildToolRequestContext({
      chatOptions: {
        ...chatOptions,
        approved_tools,
        enabled_tools,
        options: prepared.requestOptions,
      },
      input: messageWithContext,
      mode: currentMode,
      model: primaryModel,
      provider: primaryProvider,
      memoryScope: prepared.memoryScope,
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
      transport: stream ? createStreamingTurnTransport() : createBufferedTurnTransport(),
      maxSteps: resolveTurnStepBudget(chatOptions, currentMode, {
        hasActiveGoal: Boolean(prepared.activeGoal),
      }),
      env: chatOptions.env,
      model: primaryModel,
      provider: primaryProvider,
      platform: platform || "api",
      mode: currentMode,
      memoryScope: prepared.memoryScope,
      context: chatOptions.context,
      userSettings,
      requestOptions: prepared.requestOptions,
      guardrailPrompt: messageWithContext,
      deferOutputUntilValidated: Boolean(stream && userSettings?.guardrails_enabled),
      assessFinish: goalFinishGate
        ? (finishContext) => goalFinishGate.assessFinish(finishContext)
        : undefined,
      onToolResult: goalFinishGate
        ? (toolResult) => goalFinishGate.observeToolResult(toolResult)
        : undefined,
      shouldReserveGoalFinalisation: () =>
        chatOptions.max_steps === undefined && (goalFinishGate?.hasActiveGoal() ?? false),
      executionCtx: chatOptions.executionCtx,
    };

    if (stream) {
      const runsEnsemble = !isAgentExecutionMode(currentMode) && modelConfigs.length > 1;
      const turnStream = runsEnsemble
        ? createModelEnsembleStream({ ...runParams, models: modelConfigs, onTurnEnd })
        : createChatTurnStream({ ...runParams, onTurnEnd });

      return {
        stream:
          didCompact && compactionMessage
            ? prependCompactionStateEvent(turnStream, compactionMessage)
            : turnStream,
        selectedModel: primaryModel,
        ...(runsEnsemble ? { selectedModels: modelConfigs.map((m) => m.model) } : {}),
        completion_id: chatOptions.completion_id,
      };
    }

    let runResult: Awaited<ReturnType<typeof runAgentLoop>>;

    try {
      runResult = await runAgentLoop(runParams);
    } finally {
      await conversationManager.releaseTurnReservation();

      if (toolRequestContext.context) {
        try {
          await closeComposioConnectorRun(toolRequestContext.context);
        } finally {
          await disposeMCPClients(toolRequestContext.context);
        }
      }
    }

    if (!runResult.guardrailsPassed) {
      return {
        selectedModel: primaryModel,
        validation: "output",
        error: "Response did not pass safety checks",
        violations: runResult.guardrailViolations,
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
