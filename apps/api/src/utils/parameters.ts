import {
  agentControlToolDefinitions,
  FINISH_TOOL_NAME,
} from "@ngriffin_uk/polychat-library-tool-runtime";
import {
  getModelSamplingCapabilities,
  type ModelConfigItem,
  type ModelSamplingConfig,
} from "@ngriffin_uk/polychat-schemas";
import { clampNumber } from "@ngriffin_uk/polychat-utility-core";

import { isAgentExecutionMode } from "~/lib/chat/policy/mode-metadata";
import { PermissionChecker } from "~/lib/permissions/PermissionChecker";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import { listFunctionToolDefinitions } from "~/services/functions/definitions";
import type { ChatCompletionParameters } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { omitNullishValues } from "~/utils/objects";
import { resolveRequestUser } from "~/utils/requestUser";
import { getCatalogueToolName } from "~/utils/toolNames";

import { formatToolCalls } from "../lib/chat/tools/provider-tool-definitions";
import {
  hasProviderReasoningOptions,
  resolveReasoningModel,
  shouldSendProviderReasoningEffort,
} from "../lib/providers/models/reasoning";

const permissionChecker = new PermissionChecker();
const FLAT_REASONING_EFFORT_PROVIDERS = new Set([
  "azure-openai",
  "cortecs",
  "deepinfra",
  "github-copilot",
  "github-models",
  "mistral",
  "opencode",
  "opencode-go",
  "openrouter",
  "requesty",
  "vercel",
]);

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
  } as ChatCompletionParameters;
}

export function resolveEffectiveTemperature(
  requestedTemperature: number | undefined,
  modelConfig?: ModelSamplingConfig,
): number | undefined {
  const { maxTemperature, supportsTemperature } = getModelSamplingCapabilities(modelConfig);

  if (!supportsTemperature || requestedTemperature === undefined) {
    return undefined;
  }

  return clampNumber(requestedTemperature, 0, maxTemperature);
}

export function createSamplingParameters(
  params: Pick<
    ChatCompletionParameters,
    "temperature" | "top_p" | "should_think" | "reasoning_effort"
  >,
  modelConfig: ModelSamplingConfig,
): { temperature?: number; top_p?: number } {
  const capabilities = getModelSamplingCapabilities(modelConfig);
  const effectiveReasoningEffort =
    params.reasoning_effort ?? modelConfig.reasoningConfig?.defaultEffort;
  const allowsSampling =
    !capabilities.supportedReasoningEfforts ||
    (effectiveReasoningEffort !== undefined &&
      capabilities.supportedReasoningEfforts.includes(effectiveReasoningEffort));
  const temperature = allowsSampling
    ? resolveEffectiveTemperature(params.temperature, modelConfig)
    : undefined;
  const allowsTopP =
    allowsSampling &&
    capabilities.supportsTopP &&
    !params.should_think &&
    !(capabilities.restrictsCombinedTopPAndTemperature && temperature !== undefined);

  return omitNullishValues({ temperature, top_p: allowsTopP ? params.top_p : undefined });
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

const MINIMUM_REASONING_BUDGET = 1024;

function clampReasoningBudget(budget: number, effectiveMaxTokens: number): number {
  const ceiling = Math.max(effectiveMaxTokens - 1, MINIMUM_REASONING_BUDGET);

  return Math.min(Math.max(Math.floor(budget), MINIMUM_REASONING_BUDGET), ceiling);
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
    return MINIMUM_REASONING_BUDGET;
  }

  switch (reasoningEffort) {
    case "minimal":
      return clampReasoningBudget(effectiveMaxTokens * 0.25, effectiveMaxTokens);
    case "low":
      return clampReasoningBudget(effectiveMaxTokens * 0.5, effectiveMaxTokens);
    case "default":
    case "medium":
    case "thinking":
      return clampReasoningBudget(effectiveMaxTokens * 0.75, effectiveMaxTokens);
    case "high":
      return clampReasoningBudget(effectiveMaxTokens * 0.9, effectiveMaxTokens);
    case "xhigh":
    case "max":
      return clampReasoningBudget(effectiveMaxTokens, effectiveMaxTokens);
    default:
      return clampReasoningBudget(effectiveMaxTokens * 0.75, effectiveMaxTokens);
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
  const samplingCapabilities = getModelSamplingCapabilities(modelConfig);

  if (
    FLAT_REASONING_EFFORT_PROVIDERS.has(providerName) &&
    shouldSendProviderReasoningEffort(modelConfig, params.reasoning_effort)
  ) {
    commonParams.reasoning_effort = params.reasoning_effort;
  }

  if (samplingParameters.temperature !== undefined) {
    commonParams.temperature = samplingParameters.temperature;
  }

  if (params.version) {
    commonParams.version = params.version;
  }

  if (providerName !== "anthropic") {
    commonParams.seed = params.seed;

    const supportsRepetitionPenalty =
      providerName !== "cohere" && modelConfig.supportsRepetitionPenalty !== false;

    Object.assign(
      commonParams,
      omitNullishValues({
        repetition_penalty: supportsRepetitionPenalty
          ? returnValidatedPenalty("repetition_penalty", params.repetition_penalty)
          : undefined,
        frequency_penalty: samplingCapabilities.supportsFrequencyPenalty
          ? returnValidatedPenalty("frequency_penalty", params.frequency_penalty)
          : undefined,
        presence_penalty: samplingCapabilities.supportsPresencePenalty
          ? returnValidatedPenalty("presence_penalty", params.presence_penalty)
          : undefined,
      }),
    );
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
    | "tool_policy_mode"
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
    const toolPolicyMode = params.tool_policy_mode ?? params.mode;
    const enabledTools = resolveEnabledFunctionToolNames(params.enabled_tools, user);
    let tools: any[] = [];
    const availableTools = listFunctionToolDefinitions({
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
              mode: toolPolicyMode,
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
              mode: toolPolicyMode,
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
