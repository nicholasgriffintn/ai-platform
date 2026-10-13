import { applyModelResponseDefaults } from "@ngriffin_uk/polychat-ai-models";
import {
  resolvePrivateAssetUrls,
  formatMessages,
  mergeParametersWithDefaults,
  shouldEnableStreaming,
} from "@ngriffin_uk/polychat-ai-providers";
import {
  extractUsagePayload,
  normaliseTokenUsage,
  getLogger,
} from "@ngriffin_uk/polychat-ai-telemetry";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { isProviderRateLimitError } from "@ngriffin_uk/polychat-utility-server/provider-errors";

import { getChatProvider } from "~/infrastructure/providers/capabilities/chat";
import { StorageService } from "~/infrastructure/storage";
import { toProviderMessages } from "~/modules/chat/application/messages/provider-mapping";
import { compactToolOutput } from "~/modules/chat/application/messages/tool-output-compaction";
import { resolveExecutableModelForRequest } from "~/modules/chat/application/policy/model-access";
import { executeMachineChatResponse } from "~/modules/machines/application/chat-response";
import type { ChatCompletionParameters, CredentialAuthority, Message } from "~/types";

const logger = getLogger({ prefix: "services/chat/streaming/responses" });

export interface AuthorisedModelTarget {
  config: ModelConfigItem;
  credentialAuthority: CredentialAuthority;
}

export async function getAIResponse(request: ChatCompletionParameters) {
  const requestedModel = request.model || request.models?.[0];

  if (!requestedModel) {
    throw new AssistantError("Model is required", ErrorType.PARAMS_ERROR);
  }

  return getAIResponseForTarget(
    request,
    await resolveExecutableModelForRequest({
      env: request.env,
      user: request.context?.user,
      model: requestedModel,
      provider: request.provider,
    }),
  );
}

export async function getAIResponseForTarget(
  request: ChatCompletionParameters,
  { config: modelConfig, credentialAuthority }: AuthorisedModelTarget,
) {
  const {
    app_url,
    system_prompt,
    env,
    context,
    mode,
    messages,
    message,
    enabled_tools,
    tools,
    model: _model,
    models: _models,
    provider: _provider,
    ...params
  } = request;
  const user = context?.user;
  const requestedModel = modelConfig.matchingModel;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    throw new AssistantError(
      "Messages array is required and cannot be empty",
      ErrorType.PARAMS_ERROR,
    );
  }

  logger.debug("Getting AI response", {
    model: requestedModel,
    provider: modelConfig.provider,
    mode,
    user: user?.id,
  });

  if (modelConfig.machineId) {
    return executeMachineChatResponse(request, {
      ...modelConfig,
      machineId: modelConfig.machineId,
    });
  }

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

  const compactedMessages = messages.map(compactToolOutput);
  const providerMessages = toProviderMessages(compactedMessages);

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
    response = await provider.getResponse(parameters, user?.id);
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
