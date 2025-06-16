import { Guardrails } from "~/lib/guardrails";
import type { Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";
import type { CoreChatOptions } from "../core";
import { RequestPreparer } from "../preparation/RequestPreparer";
import { getAIResponse } from "../responses";
import {
  createMultiModelStream,
  createStreamWithPostProcessing,
} from "../streaming";
import { handleToolCalls } from "../tools";
import { ValidationPipeline } from "../validation/ValidationPipeline";

const logger = getLogger({ prefix: "CHAT_ORCHESTRATOR" });

export class ChatOrchestrator {
  private validator: ValidationPipeline;
  private preparer: RequestPreparer;

  constructor(env: any) {
    this.validator = new ValidationPipeline();
    this.preparer = new RequestPreparer(env);
  }

  async process(options: CoreChatOptions) {
    try {
      logger.debug("Starting chat orchestration", {
        completion_id: options.completion_id,
        model: options.model,
        mode: options.mode,
      });

      const validationResult = await this.validator.validate(options);

      if (!validationResult.validation.isValid) {
        logger.warn("Validation failed", {
          error: validationResult.validation.error,
          type: validationResult.validation.validationType,
          completion_id: options.completion_id,
        });

        return {
          selectedModel:
            validationResult.context.modelConfig?.matchingModel || "unknown",
          validation: validationResult.validation.validationType || "input",
          error: validationResult.validation.error,
          violations: validationResult.validation.violations,
          rawViolations: validationResult.validation.rawViolations,
        };
      }

      const prepared = await this.preparer.prepare(
        options,
        validationResult.context,
      );

      logger.debug("Request prepared successfully", {
        completion_id: options.completion_id,
        primaryModel: prepared.primaryModel,
        messageCount: prepared.messages.length,
      });

      return this.executeRequest(options, prepared);
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

      throw new AssistantError(errorMessage, errorType, error);
    }
  }

  private async executeRequest(options: CoreChatOptions, prepared: any) {
    const {
      platform = "api",
      stream = false,
      disable_functions,
      should_think,
      response_format,
      lang,
      temperature,
      max_tokens,
      top_p,
      top_k,
      seed,
      repetition_penalty,
      frequency_penalty,
      presence_penalty,
      n,
      stop,
      logit_bias,
      metadata,
      reasoning_effort,
      store = true,
      tools,
      parallel_tool_calls,
      tool_choice,
      enabled_tools = [],
      current_step,
      max_steps,
    } = options;

    const {
      modelConfigs,
      primaryModel,
      primaryProvider,
      conversationManager,
      messages,
      systemPrompt,
      messageWithContext,
      userSettings,
      currentMode,
    } = prepared;

    await conversationManager.checkUsageLimits(primaryModel);

    if (modelConfigs.length > 1 && stream) {
      const transformedStream = createMultiModelStream(
        {
          app_url: options.app_url,
          system_prompt: systemPrompt,
          env: options.env,
          user: options.user?.id ? options.user : undefined,
          disable_functions,
          completion_id: options.completion_id,
          messages,
          message: messageWithContext,
          models: modelConfigs,
          mode: currentMode,
          should_think,
          response_format,
          lang,
          temperature,
          max_tokens,
          top_p,
          top_k,
          seed,
          repetition_penalty,
          frequency_penalty,
          presence_penalty,
          stop,
          logit_bias,
          metadata,
          reasoning_effort,
          store,
          enabled_tools,
          tools,
          parallel_tool_calls,
          tool_choice,
          current_step,
          max_steps,
        },
        {
          env: options.env,
          completion_id: options.completion_id!,
          model: primaryModel,
          provider: primaryProvider,
          platform: platform || "api",
          user: options.user,
          userSettings,
          app_url: options.app_url,
          mode: currentMode,
        },
        conversationManager,
      );

      return {
        stream: transformedStream,
        selectedModel: primaryModel,
        selectedModels: modelConfigs.map((m) => m.model),
        completion_id: options.completion_id,
      };
    }

    const params = {
      app_url: options.app_url,
      system_prompt: systemPrompt,
      env: options.env,
      user: options.user?.id ? options.user : undefined,
      disable_functions,
      completion_id: options.completion_id,
      messages,
      message: messageWithContext,
      model: primaryModel,
      mode: currentMode,
      should_think,
      response_format,
      lang,
      temperature,
      max_tokens,
      top_p,
      top_k,
      seed,
      repetition_penalty,
      frequency_penalty,
      presence_penalty,
      n,
      stream,
      stop,
      logit_bias,
      metadata,
      reasoning_effort,
      store,
      enabled_tools,
      tools,
      parallel_tool_calls,
      tool_choice,
      current_step,
      max_steps,
      provider: primaryProvider,
    };

    const response = await getAIResponse(params);

    if (response instanceof ReadableStream) {
      const transformedStream = await createStreamWithPostProcessing(
        response,
        params,
        conversationManager,
      );

      return {
        stream: transformedStream,
        selectedModel: primaryModel,
        completion_id: options.completion_id,
      };
    }

    if (!response.response && !response.tool_calls) {
      throw new AssistantError(
        "No response generated by the model",
        ErrorType.PARAMS_ERROR,
      );
    }

    if (response.response) {
      const guardrails = Guardrails.getInstance(
        options.env,
        options.user,
        userSettings,
      );
      const outputValidation = await guardrails.validateOutput(
        response.response,
        options.user?.id,
        options.completion_id,
      );

      if (!outputValidation.isValid) {
        return {
          selectedModel: primaryModel,
          validation: "output",
          error:
            outputValidation.rawResponse?.blockedResponse ||
            "Response did not pass safety checks",
          violations: outputValidation.violations,
          rawViolations: outputValidation.rawResponse,
        };
      }
    }

    const toolResponses: Message[] = [];
    if (response.tool_calls?.length > 0) {
      const toolResults = await handleToolCalls(
        options.completion_id!,
        response,
        conversationManager,
        {
          env: options.env,
          request: {
            completion_id: options.completion_id!,
            input: messageWithContext,
            model: primaryModel,
            date: new Date().toISOString().split("T")[0]!,
          },
          app_url: options.app_url,
          user: options.user?.id ? options.user : undefined,
        },
      );

      toolResponses.push(...toolResults);
    }

    await conversationManager.add(options.completion_id!, {
      role: "assistant",
      content: response.response,
      citations: response.citations || null,
      data: response.data || null,
      log_id: options.env.AI.aiGatewayLogId || response.log_id,
      mode: currentMode,
      id: generateId(),
      timestamp: Date.now(),
      model: primaryModel,
      platform: platform || "api",
      usage: response.usage || response.usageMetadata,
      tool_calls: response.tool_calls || null,
    });

    return {
      response,
      toolResponses,
      selectedModel: primaryModel,
      selectedModels:
        modelConfigs.length > 1 ? modelConfigs.map((m) => m.model) : undefined,
      completion_id: options.completion_id,
    };
  }

  private determineErrorType(error: any): ErrorType {
    if (
      error.name === "TimeoutError" ||
      error.message?.includes("timeout") ||
      error.message?.includes("network") ||
      error.code === "ECONNRESET" ||
      error.code === "ECONNABORTED"
    ) {
      return ErrorType.NETWORK_ERROR;
    }

    if (
      error.status === 429 ||
      error.message?.includes("rate limit") ||
      error.message?.includes("too many requests")
    ) {
      return ErrorType.RATE_LIMIT_ERROR;
    }

    if (error.status === 401 || error.status === 403) {
      return ErrorType.AUTHENTICATION_ERROR;
    }

    if (
      error.message?.includes("model") ||
      error.message?.includes("parameter") ||
      error.message?.includes("token limit")
    ) {
      return ErrorType.PROVIDER_ERROR;
    }

    if (error.status >= 500) {
      return ErrorType.PROVIDER_ERROR;
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
