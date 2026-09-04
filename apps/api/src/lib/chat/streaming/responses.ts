import { toProviderMessages } from "~/lib/chat/messages/provider-mapping";
import { rewriteChatInput } from "~/lib/chat/policy/input-rewriting";
import { resolveExecutableModelForRequest } from "~/lib/chat/policy/model-access";
import { getChatProvider } from "~/lib/providers/capabilities/chat";
import { applyModelResponseDefaults } from "~/lib/providers/models/responseDefaults";
import { resolvePrivateAssetUrls } from "~/lib/providers/utils/privateAssets";
import { StorageService } from "~/lib/storage";
import { extractUsagePayload } from "~/lib/usage/extractUsage";
import { normaliseTokenUsage } from "~/lib/usage/tokenUsage";
import type { ChatCompletionParameters, Message } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getLogger } from "~/utils/logger";
import { formatMessages } from "~/utils/messages";
import { mergeParametersWithDefaults, shouldEnableStreaming } from "~/utils/parameters";
import { isProviderRateLimitError, isRetryableProviderError } from "~/utils/providerErrors";
import { withRetry } from "~/utils/retries";

const logger = getLogger({ prefix: "lib/chat/streaming/responses" });

export async function getAIResponse(request: ChatCompletionParameters) {
  const {
    app_url,
    system_prompt,
    env,
    context,
    mode,
    model,
    models,
    provider: requestedProvider,
    messages,
    message,
    enabled_tools,
    tools,
    ...params
  } = request;
  const user = context?.user;
  const requestedModel = model || models?.[0];

  if (!requestedModel) {
    throw new AssistantError("Model is required", ErrorType.PARAMS_ERROR);
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new AssistantError(
      "Messages array is required and cannot be empty",
      ErrorType.PARAMS_ERROR,
    );
  }

  logger.debug("Getting AI response", {
    model: requestedModel,
    provider: requestedProvider,
    mode,
    user: user?.id,
  });

  const { config: modelConfig, credentialAuthority } = await resolveExecutableModelForRequest({
    env,
    user,
    model: requestedModel,
    provider: requestedProvider,
  });

  let provider;

  try {
    provider = getChatProvider(modelConfig?.provider || "workers-ai", {
      env,
      user,
    });
  } catch (error: any) {
    logger.error("Failed to initialize provider", {
      provider: modelConfig?.provider,
      error,
    });
    throw new AssistantError(
      `Failed to initialize provider ${modelConfig?.provider}: ${error.message}`,
      ErrorType.PROVIDER_ERROR,
    );
  }

  const providerMessages = toProviderMessages(await rewriteChatInput(request));

  const filteredMessages =
    mode === "normal"
      ? providerMessages.filter((msg: Message) => !msg.mode || msg.mode === "normal")
      : providerMessages;

  if (filteredMessages.length === 0) {
    logger.warn("No messages after filtering", { mode });
    throw new AssistantError("No valid messages after filtering", ErrorType.PARAMS_ERROR);
  }

  const resolvedAssetParams = await resolvePrivateAssetUrls({
    params: { ...request, messages: filteredMessages },
    storageService: StorageService.forPrivateAssetsEnv(env),
    assetsUrl: env.API_BASE_URL || "",
  });

  let formattedMessages;
  const resolvedModel = modelConfig.matchingModel;

  try {
    formattedMessages = formatMessages(
      provider.name,
      resolvedAssetParams.messages,
      system_prompt,
      resolvedModel,
    );
  } catch (error: any) {
    logger.error("Failed to format messages", { error });
    throw new AssistantError(`Failed to format messages: ${error.message}`, ErrorType.PARAMS_ERROR);
  }

  const shouldStream = shouldEnableStreaming(
    modelConfig,
    provider.supportsStreaming,
    params.stream,
  );

  let parameters;

  try {
    parameters = mergeParametersWithDefaults({
      ...applyModelResponseDefaults(params, modelConfig),
      model: resolvedModel,
      provider: modelConfig.provider,
      messages: formattedMessages,
      message,
      mode,
      app_url,
      system_prompt,
      env,
      context,
      credentialAuthority,
      stream: shouldStream,
      enabled_tools,
      tools,
    });
  } catch (error: any) {
    logger.error("Failed to merge parameters", { error });
    throw new AssistantError(
      `Failed to prepare request parameters: ${error.message}`,
      ErrorType.PARAMS_ERROR,
    );
  }

  const startTime = Date.now();
  let response;

  try {
    response = await withRetry(() => provider.getResponse(parameters, user?.id), {
      retryCount: 1,
      baseDelayMs: 1000,
      isRetryableError: isRetryableProviderError,
      onRetry: (attempt, error, delayMs) => {
        logger.warn("Retrying model invocation after retryable provider error", {
          model: requestedModel,
          provider: provider.name,
          attempt,
          delayMs,
          error,
        });
      },
    });
  } catch (err: any) {
    let errorType = ErrorType.PROVIDER_ERROR;
    let statusCode =
      typeof err.statusCode === "number"
        ? err.statusCode
        : typeof err.status === "number"
          ? err.status
          : 500;

    if (isProviderRateLimitError(err)) {
      errorType = ErrorType.RATE_LIMIT_ERROR;
      statusCode = 429;
    } else if (statusCode >= 500) {
      errorType = ErrorType.PROVIDER_ERROR;
    } else if (statusCode === 401 || statusCode === 403) {
      errorType = ErrorType.AUTHENTICATION_ERROR;
    }

    logger.error("Model invocation failed", {
      model: requestedModel,
      provider: provider.name,
      error: err,
      errorType,
    });

    throw new AssistantError(
      `${provider.name} error: ${err.message || "Unknown error"}`,
      errorType,
      statusCode,
      err instanceof AssistantError ? err.context : {},
    );
  }

  const durationMs = Date.now() - startTime;
  const usageTokens = normaliseTokenUsage(extractUsagePayload(response))?.total_tokens ?? null;

  logger.debug("Model invocation metrics", {
    model: requestedModel,
    provider: provider.name,
    durationMs,
    usageTokens,
  });

  if (!response) {
    throw new AssistantError("Provider returned empty response", ErrorType.PROVIDER_ERROR);
  }

  logger.debug("AI response received", { model: requestedModel, mode, user: user?.id });

  return response;
}
