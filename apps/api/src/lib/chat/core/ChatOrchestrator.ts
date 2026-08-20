import { createGoalFinishGate } from "~/lib/chat/agent/goal-gate";
import { runAgentLoop, type ModelResponse } from "~/lib/chat/agent/runAgentLoop";
import { createAgentExecutionStream } from "~/lib/chat/core/agent-stream";
import { buildStoredAssistantMessage } from "~/lib/chat/core/assistant-message";
import { prependCompactionStateEvent } from "~/lib/chat/core/compaction-stream";
import { createChatExecutionRequest } from "~/lib/chat/core/execution-request";
import { buildToolRequestContext } from "~/lib/chat/core/request-context";
import { isAgentExecutionMode } from "~/lib/chat/mode-metadata";
import { createMultiModelStream } from "~/lib/chat/multiModalStreaming";
import { RequestPreparer, type PreparedRequest } from "~/lib/chat/preparation/RequestPreparer";
import { getAIResponse } from "~/lib/chat/responses";
import { createStreamWithPostProcessing } from "~/lib/chat/streaming";
import { pruneMessagesToFitContext } from "~/lib/chat/utils";
import { ValidationPipeline } from "~/lib/chat/validation/ValidationPipeline";
import { resolveServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { resolveModeMaxSteps } from "~/lib/permissions/PermissionChecker";
import { Guardrails } from "~/lib/providers/capabilities/guardrails";
import { captureTrainingExample } from "~/lib/providers/capabilities/training/captureTrainingExample";
import { SessionManager } from "~/lib/session/SessionManager";
import { closeComposioConnectorRun } from "~/services/apps/connectors/composio-run";
import { acquireThread, releaseThread } from "~/services/conversations/coordinator/client";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import { GOAL_STATUS_MARKER_EVENTS, recordGoalMarker } from "~/services/goals/goalMarker";
import { GoalService } from "~/services/goals/GoalService";
import type { ChatMode, CoreChatOptions, Message } from "~/types";
import { isAbortError } from "~/utils/abort";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";

const logger = getLogger({ prefix: "lib/chat/core/ChatOrchestrator" });
const RECIPE_CHAT_DEFAULT_MAX_STEPS = 4;
const RECIPE_CONNECTOR_DEFAULT_MAX_STEPS = 8;
const RECIPE_CONNECTOR_TOOL_NAME = "use_recipe_connector";

function resolveChatMaxSteps(chatOptions: CoreChatOptions): number | undefined {
  if (typeof chatOptions.max_steps === "number") {
    return chatOptions.max_steps;
  }

  const enabledFunctionTools = resolveEnabledFunctionToolNames(
    chatOptions.enabled_tools,
    chatOptions.context?.user,
  );

  if (enabledFunctionTools.has(RECIPE_CONNECTOR_TOOL_NAME)) {
    return RECIPE_CONNECTOR_DEFAULT_MAX_STEPS;
  }

  return chatOptions.options?.recipe ? RECIPE_CHAT_DEFAULT_MAX_STEPS : undefined;
}

export class ChatOrchestrator {
  private validator: ValidationPipeline;
  private preparer: RequestPreparer;

  constructor(env: any) {
    this.validator = new ValidationPipeline();
    this.preparer = new RequestPreparer(env);
  }

  /**
   * A turn owns the conversation's history while it runs, so compaction and
   * other thread work queue behind it instead of interleaving. Inbound channel
   * turns arrive from a queue that can deliver a batch at once, so refusing
   * here is what stops two messages from the same sender interleaving on one
   * conversation; the queue redelivers the refused one.
   */
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

  private async resolveGoalFinishGate(
    chatOptions: CoreChatOptions,
    currentMode: ChatMode,
    conversationManager: ConversationManager,
  ) {
    const user = chatOptions.context?.user;

    if (!user?.id || user.plan_id !== "pro" || !chatOptions.completion_id) {
      return undefined;
    }

    const goalService = new GoalService(chatOptions.context.repositories.goals);
    const goal = await goalService.getActiveGoal({
      conversationId: chatOptions.completion_id,
    });

    if (!goal || goal.status !== "active") {
      return undefined;
    }

    return createGoalFinishGate({
      goalService,
      goal,
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

      // Taken before preparation, which persists the incoming message: refusing
      // after that point would leave the user's message stored with no reply.
      const heldThread = await this.holdThreadForTurn(options);

      try {
        const prepared = await this.preparer.prepare(options, validationResult.context);

        return await this.executeRequest(options, prepared);
      } finally {
        if (heldThread) {
          await releaseThread({
            env: options.env,
            conversationId: options.completion_id,
          });
        }
      }
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

  private async executeRequest(chatOptions: CoreChatOptions, prepared: PreparedRequest) {
    const {
      platform = "api",
      stream = false,
      store = true,
      enabled_tools: requestedEnabledTools = [],
      approved_tools = [],
      max_steps,
    } = chatOptions;
    const resolvedMaxSteps = resolveChatMaxSteps(chatOptions);

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

    const modelsToCheck = new Set(modelConfigs.map((config) => config.model));

    for (const modelToCheck of modelsToCheck) {
      await conversationManager.checkUsageLimits(modelToCheck);
    }

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
          contextWindow: (primaryModelConfig as { contextWindow?: number })?.contextWindow,
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
      resolvedMaxSteps,
    });

    if (!isAgentExecutionMode(currentMode) && modelConfigs.length > 1 && stream) {
      const transformedStream = createMultiModelStream(
        executionRequest.multiModelStreamRequest(),
        executionRequest.multiModelStreamOptions(),
        conversationManager,
      );

      return {
        stream:
          didCompact && compactionMessage
            ? prependCompactionStateEvent(transformedStream, compactionMessage)
            : transformedStream,
        selectedModel: primaryModel,
        selectedModels: modelConfigs.map((m) => m.model),
        completion_id: chatOptions.completion_id,
      };
    }

    const requestParams = executionRequest.providerRequest();

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

    if (isAgentExecutionMode(currentMode) && stream) {
      const agentStream = createAgentExecutionStream({
        requestParams,
        completionId: chatOptions.completion_id,
        conversationManager,
        toolRequestContext,
        maxSteps: resolveModeMaxSteps(currentMode, max_steps),
        envLogId: chatOptions.env.AI.aiGatewayLogId,
        mode: currentMode,
        model: primaryModel,
        platform: platform || "api",
        requestOptions: prepared.requestOptions,
      });

      return {
        stream:
          didCompact && compactionMessage
            ? prependCompactionStateEvent(agentStream, compactionMessage)
            : agentStream,
        selectedModel: primaryModel,
        completion_id: chatOptions.completion_id,
      };
    }

    const toolResponses: Message[] = [];
    let response: ModelResponse | ReadableStream;
    const responseAlreadyStored = false;

    if (stream) {
      response = await getAIResponse(requestParams);
    } else {
      let agentResult;

      try {
        agentResult = await runAgentLoop({
          requestParams,
          completionId: chatOptions.completion_id,
          conversationManager,
          toolRequestContext,
          maxSteps: resolveModeMaxSteps(currentMode, resolvedMaxSteps ?? max_steps),
          assessFinish: await this.resolveGoalFinishGate(
            chatOptions,
            currentMode,
            conversationManager,
          ),
        });
      } finally {
        if (toolRequestContext.context) {
          await closeComposioConnectorRun(toolRequestContext.context);
        }
      }

      response = agentResult.response;
      toolResponses.push(...agentResult.toolResponses);
    }

    if (response instanceof ReadableStream) {
      const transformedStream = await createStreamWithPostProcessing(
        response,
        executionRequest.streamOptions(primaryModel, primaryProvider),
        conversationManager,
      );

      return {
        stream:
          didCompact && compactionMessage
            ? prependCompactionStateEvent(transformedStream, compactionMessage)
            : transformedStream,
        selectedModel: primaryModel,
        completion_id: chatOptions.completion_id,
      };
    }

    if (!response.response && !response.tool_calls) {
      throw new AssistantError("No response generated by the model", ErrorType.PARAMS_ERROR);
    }

    if (response.response) {
      const guardrails = new Guardrails(chatOptions.env, chatOptions.context?.user, userSettings);
      const outputValidation = await guardrails.validateOutput(
        response.response,
        chatOptions.context?.user?.id,
        chatOptions.completion_id,
      );

      if (!outputValidation?.isValid) {
        return {
          selectedModel: primaryModel,
          validation: "output",
          error:
            outputValidation.rawResponse?.blockedResponse || "Response did not pass safety checks",
          violations: outputValidation.violations,
          rawViolations: outputValidation.rawResponse,
        };
      }
    }

    if (!responseAlreadyStored) {
      await conversationManager.add(
        chatOptions.completion_id,
        buildStoredAssistantMessage({
          response,
          content: response.response || "",
          envLogId: chatOptions.env.AI.aiGatewayLogId,
          mode: currentMode,
          model: primaryModel,
          platform: platform || "api",
          requestOptions: prepared.requestOptions,
        }),
      );
    }

    if (userSettings?.tracking_enabled) {
      const userMessage = messages.find((m) => m.role === "user");

      if (userMessage && response.response && store) {
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
          assistantResponse: response.response,
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
      response,
      toolResponses,
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
