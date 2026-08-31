import {
  agentControlToolDefinitions,
  FINISH_TOOL_NAME,
} from "@ngriffin_uk/polychat-library-tool-runtime";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import { PermissionChecker } from "~/lib/permissions/PermissionChecker";
import { listFunctionTools } from "~/services/functions";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { omitNullishValues } from "~/utils/objects";
import { resolveRequestUser } from "~/utils/requestUser";
import { getCatalogueToolName } from "~/utils/toolNames";

import { formatToolCalls } from "../lib/chat/tools/execution";
import {
  hasProviderReasoningOptions,
  resolveReasoningModel,
} from "../lib/providers/models/reasoning";

const permissionChecker = new PermissionChecker();

/**
 * Restricts max_tokens to the model's configured maximum
 * @param requestedMaxTokens - The user-requested max tokens
 * @param modelMaxTokens - The model's configured maximum tokens
 * @returns The effective max tokens (never exceeds model limit)
 */
export function getEffectiveMaxTokens(
  requestedMaxTokens: number | undefined,
  modelMaxTokens: number | undefined,
  defaultMaxTokens = 8192,
): number {
  const requested = requestedMaxTokens ?? defaultMaxTokens;

  if (modelMaxTokens === undefined) {
    return requested;
  }

  return Math.min(requested, modelMaxTokens);
}

const MAX_OUTPUT_TOKEN_DEFAULTS = {
  short: 2_048,
  normal: 8_192,
  long: 16_384,
  reasoning: 32_768,
} as const;

type OutputTokenRequest = Pick<
  ChatCompletionParameters,
  "conversation_type" | "max_tokens" | "mode" | "options" | "reasoning_effort" | "response_format"
>;

function requestsStructuredJson(responseFormat: OutputTokenRequest["response_format"]): boolean {
  return (
    responseFormat !== undefined &&
    "type" in responseFormat &&
    (responseFormat.type === "json_object" || responseFormat.type === "json_schema")
  );
}

function usesReasoningDefault(
  params: OutputTokenRequest,
  modelConfig: ModelConfigItem | undefined,
): boolean {
  if (params.reasoning_effort !== undefined) {
    return params.reasoning_effort !== "none" && params.reasoning_effort !== "simulated-thinking";
  }

  return hasProviderReasoningOptions(modelConfig);
}

export function resolveDefaultMaxOutputTokens(
  params: OutputTokenRequest,
  modelConfig: ModelConfigItem | undefined,
): number {
  if (requestsStructuredJson(params.response_format)) {
    return MAX_OUTPUT_TOKEN_DEFAULTS.short;
  }

  if (usesReasoningDefault(params, modelConfig)) {
    return MAX_OUTPUT_TOKEN_DEFAULTS.reasoning;
  }

  if (
    isAgentExecutionMode(params.mode) ||
    params.conversation_type === "task" ||
    params.options?.sandbox?.enabled
  ) {
    return MAX_OUTPUT_TOKEN_DEFAULTS.long;
  }

  return MAX_OUTPUT_TOKEN_DEFAULTS.normal;
}

export function resolveEffectiveMaxTokens(
  params: OutputTokenRequest,
  modelConfig: ModelConfigItem | undefined,
): number {
  return getEffectiveMaxTokens(
    params.max_tokens,
    modelConfig?.maxTokens,
    resolveDefaultMaxOutputTokens(params, modelConfig),
  );
}

/**
 * Merges default parameters with user-provided parameters
 * @param params - The user-provided parameters
 * @param defaults - The default parameters
 * @returns The merged parameters
 */
export function mergeParametersWithDefaults(
  params: Partial<ChatCompletionParameters>,
  defaults: Partial<ChatCompletionParameters> = {},
): ChatCompletionParameters {
  return {
    ...defaults,
    ...params,
    rag_options: {
      ...defaults.rag_options,
      ...params.rag_options,
    },
  } as ChatCompletionParameters;
}

export function createSamplingParameters(
  params: Pick<ChatCompletionParameters, "temperature" | "top_p" | "should_think">,
  modelConfig: Pick<ModelConfigItem, "supportsTemperature" | "supportsTopP">,
): { temperature?: number; top_p?: number } {
  const temperature = modelConfig.supportsTemperature ? params.temperature : undefined;
  const topP =
    temperature === undefined && modelConfig.supportsTopP && !params.should_think
      ? params.top_p
      : undefined;

  return omitNullishValues({ temperature, top_p: topP });
}

export function isFimCompletionRequest(
  params: Pick<ChatCompletionParameters, "fim_mode" | "suffix">,
): boolean {
  return params.fim_mode === true || typeof params.suffix !== "undefined";
}

export function createFimParameters(params: ChatCompletionParameters): Record<string, any> {
  return omitNullishValues({
    model: params.model,
    prompt: params.prompt,
    suffix: params.suffix,
    max_tokens: params.max_tokens,
    min_tokens: params.min_tokens,
    temperature: params.temperature,
    top_p: params.top_p,
    stop: params.stop,
    stream: params.stream,
  });
}

export function createTextGenerationParameters(
  params: ChatCompletionParameters,
): Record<string, unknown> {
  return omitNullishValues({
    max_new_tokens: typeof params.max_tokens === "number" ? params.max_tokens : undefined,
    temperature: typeof params.temperature === "number" ? params.temperature : undefined,
    top_p: typeof params.top_p === "number" ? params.top_p : undefined,
    return_full_text: false,
  });
}

export function calculateReasoningBudget(
  params: Pick<ChatCompletionParameters, "max_tokens" | "reasoning_effort">,
  modelConfig?: ModelConfigItem,
): number {
  const reasoningEffort = params.reasoning_effort;

  if (reasoningEffort === "none" || reasoningEffort === "simulated-thinking") {
    return 0;
  }

  const effectiveMaxTokens = resolveEffectiveMaxTokens(params, modelConfig);

  if (!effectiveMaxTokens) {
    return 1024;
  }

  switch (reasoningEffort) {
    case "minimal":
      return Math.max(Math.floor(effectiveMaxTokens * 0.25), 1024);
    case "low":
      return Math.max(Math.floor(effectiveMaxTokens * 0.5), 1024);
    case "default":
    case "medium":
    case "thinking":
      return Math.max(Math.floor(effectiveMaxTokens * 0.75), 1024);
    case "high":
      return Math.max(Math.floor(effectiveMaxTokens * 0.9), 1024);
    case "xhigh":
    case "max":
      return effectiveMaxTokens;
    default:
      return Math.max(Math.floor(effectiveMaxTokens * 0.75), 1024);
  }
}

function returnValidatedPenalty(
  key: "repetition_penalty" | "frequency_penalty" | "presence_penalty",
  value: number | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (key === "repetition_penalty") {
    if (value < 0 || value > 2) {
      throw new AssistantError(
        "Repetition penalty must be between 0 and 2, inclusive.",
        ErrorType.PARAMS_ERROR,
      );
    }
  } else if (value < -2) {
    throw new AssistantError(`${key} must be greater than or equal to -2.`, ErrorType.PARAMS_ERROR);
  }

  return value;
}

/**
 * Creates common parameters that most providers use
 * @param params - The chat completion parameters
 * @param modelConfig - The model configuration
 * @param providerName - The provider name for compatibility checks
 * @param isOpenAiCompatible - Whether the provider is OpenAI compatible
 * @returns Common parameters object
 */
export function createCommonParameters(
  params: ChatCompletionParameters,
  modelConfig: any,
  providerName: string,
  isOpenAiCompatible = false,
): Record<string, any> {
  const resolvedModel =
    resolveReasoningModel(modelConfig, params.reasoning_effort) ||
    modelConfig.matchingModel ||
    params.model;

  function getModelName(): string {
    if (isOpenAiCompatible) {
      return `${providerName}/${resolvedModel}`;
    }

    if (providerName === "huggingface") {
      return `${resolvedModel}:fastest`;
    }

    return resolvedModel;
  }

  const modelName = getModelName();

  const commonParams: Record<string, any> = {
    model: modelName,
    messages: params.messages,
  };
  const samplingParameters = createSamplingParameters(params, modelConfig);

  if (samplingParameters.temperature !== undefined) {
    commonParams.temperature = samplingParameters.temperature;
  }

  if (params.version) {
    commonParams.version = params.version;
  }

  if (providerName !== "anthropic") {
    commonParams.seed = params.seed;
    if (providerName !== "cohere" && modelConfig.supportsRepetitionPenalty !== false) {
      commonParams.repetition_penalty = returnValidatedPenalty(
        "repetition_penalty",
        params.repetition_penalty,
      );
    }

    if (modelConfig.supportsFrequencyPenalty !== false) {
      commonParams.frequency_penalty = returnValidatedPenalty(
        "frequency_penalty",
        params.frequency_penalty,
      );
    }

    if (modelConfig.supportsPresencePenalty !== false) {
      commonParams.presence_penalty = returnValidatedPenalty(
        "presence_penalty",
        params.presence_penalty,
      );
    }
  }

  if (providerName === "openai" && params.metadata) {
    commonParams.metadata = params.metadata;
  }

  const effectiveMaxTokens = resolveEffectiveMaxTokens(params, modelConfig);

  if (providerName === "openai") {
    commonParams.max_completion_tokens = effectiveMaxTokens;
  } else {
    commonParams.max_tokens = effectiveMaxTokens;
  }

  if (providerName === "cohere") {
    commonParams.k = params.top_k;
    commonParams.stop_sequences = params.stop;
  }

  if (params.model && params.response_format) {
    const supportsResponseFormat = modelConfig?.supportsResponseFormat || false;

    if (supportsResponseFormat) {
      commonParams.response_format = params.response_format;
    }
  }

  if (samplingParameters.top_p !== undefined && params.model) {
    if (providerName === "cohere") {
      commonParams.p = samplingParameters.top_p;
    } else {
      commonParams.top_p = samplingParameters.top_p;
    }
  }

  return commonParams;
}

/**
 * Gets tools configuration for a provider if the model supports functions
 * @param params - The chat completion parameters
 * @param modelConfig - The model configuration
 * @param providerName - The provider name
 * @returns Tools configuration object to merge with parameters
 */
export function getToolsForProvider(
  params: Pick<
    ChatCompletionParameters,
    | "model"
    | "disable_functions"
    | "response_format"
    | "enabled_tools"
    | "options"
    | "tools"
    | "parallel_tool_calls"
    | "tool_choice"
    | "context"
    | "connectedConnectorProviders"
    | "mode"
    | "conversation_type"
    | "require_approval_for"
    | "enforce_mode_tool_policy"
  >,
  modelConfig: any,
  providerName: string,
): { tools?: any[]; parallel_tool_calls?: boolean; tool_choice?: any } {
  if (!params.model || params.disable_functions || params.response_format) {
    return {};
  }

  const supportsToolCalls = modelConfig?.supportsToolCalls || false;

  if (!supportsToolCalls) {
    return {};
  }

  try {
    const user = resolveRequestUser(params);
    const enabledTools = resolveEnabledFunctionToolNames(params.enabled_tools, user);
    let tools: any[] = [];
    const availableTools = listFunctionTools({
      connectedConnectorProviders: params.connectedConnectorProviders,
      selectedConnectorProvider: params.options?.connector?.provider,
    });

    if (params.tools) {
      const providedTools = params.tools;
      const catalogueToolNames = new Set(availableTools.map((tool) => tool.name));
      const providedCustomTools = providedTools.filter((tool) => {
        const name = getCatalogueToolName(tool);

        return !name || !catalogueToolNames.has(name);
      });
      const filteredFunctions = availableTools
        .filter((func) => enabledTools.has(func.name))
        .filter(
          (func) =>
            permissionChecker.checkToolAccess({
              toolName: func.name,
              mode: params.mode,
              user,
              toolType: func.type,
              toolPermissions: func.permissions,
              requireApprovalFor: params.require_approval_for,
              enforceModePolicy: params.enforce_mode_tool_policy,
            }).allowed,
        );
      const availableToolDeclarations = formatToolCalls(providerName, filteredFunctions);

      tools = [...availableToolDeclarations, ...providedCustomTools];
    } else {
      const filteredFunctions = availableTools
        .filter((func) => enabledTools.has(func.name))
        .filter(
          (func) =>
            permissionChecker.checkToolAccess({
              toolName: func.name,
              mode: params.mode,
              user,
              toolType: func.type,
              toolPermissions: func.permissions,
              requireApprovalFor: params.require_approval_for,
              enforceModePolicy: params.enforce_mode_tool_policy,
            }).allowed,
        );

      tools = formatToolCalls(providerName, filteredFunctions);
    }

    if (isAgentExecutionMode(params.mode)) {
      const controlTools =
        params.conversation_type === "task"
          ? agentControlToolDefinitions.filter((tool) => tool.function.name !== FINISH_TOOL_NAME)
          : agentControlToolDefinitions;

      tools = [...tools, ...formatToolCalls(providerName, controlTools)];
    }

    const result: {
      tools?: any[];
      parallel_tool_calls?: boolean;
      tool_choice?: any;
    } = {};

    if (tools.length > 0) {
      result.tools = tools;
    }

    if (providerName !== "cohere" && modelConfig?.supportsParallelToolCalls !== false) {
      result.parallel_tool_calls = params.parallel_tool_calls;
    }

    if (modelConfig?.supportsToolChoice === false) {
      return result;
    }

    if (providerName === "cohere") {
      if (params.tool_choice === "required") {
        result.tool_choice = "REQUIRED";
      }
    } else {
      result.tool_choice = params.tool_choice;
    }

    return result;
  } catch (error: any) {
    throw new AssistantError(
      `Failed to format tool calls: ${error.message}`,
      ErrorType.PARAMS_ERROR,
    );
  }
}

/**
 * Checks if streaming is supported for the model type
 * @param modelConfig - The model configuration
 * @param supportsStreaming - Whether the provider supports streaming
 * @param stream - Whether streaming is requested
 * @returns Whether streaming should be enabled
 */
export function shouldEnableStreaming(
  modelConfig: ModelConfigItem,
  supportsStreaming: boolean,
  stream: boolean,
): boolean {
  if (!modelConfig?.modalities) {
    return false;
  }

  const inputs = modelConfig.modalities.input ?? [];
  const outputs = modelConfig.modalities.output ?? inputs;
  const supportsTextOutput =
    outputs.includes("text") || (!outputs.length && inputs.includes("text"));
  const isCodingModel = modelConfig?.promptTemplate === "coding";
  const modelTypeSupportsStreaming = supportsTextOutput || isCodingModel;

  return (
    stream &&
    supportsStreaming &&
    modelConfig.supportsStreaming !== false &&
    modelTypeSupportsStreaming
  );
}

export function createStreamingParameters(
  modelConfig: ModelConfigItem,
  supportsStreaming: boolean,
  stream: boolean,
  options: { includeUsage?: boolean } = {},
): Record<string, any> {
  if (!shouldEnableStreaming(modelConfig, supportsStreaming, stream)) {
    return {};
  }

  return options.includeUsage === false
    ? { stream: true }
    : { stream: true, stream_options: { include_usage: true } };
}
