import {
  resolveReasoningModel,
  shouldSendProviderReasoningEffort,
} from "@ngriffin_uk/polychat-ai-models";
import {
  getModelSamplingCapabilities,
  type ModelConfigItem,
  type ModelSamplingConfig,
} from "@ngriffin_uk/polychat-schemas";
import { clampNumber } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { omitNullishValues } from "@ngriffin_uk/polychat-utility-server/objects";

import { formatToolCalls } from "./tool-definitions.js";
import type { ChatCompletionParameters } from "./types/index.js";

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

export function getEffectiveMaxTokens(
  requestedMaxTokens: number | undefined,
  modelMaxTokens: number | undefined,
): number | undefined {
  if (requestedMaxTokens === undefined || modelMaxTokens === undefined) {
    return requestedMaxTokens;
  }

  return Math.min(requestedMaxTokens, modelMaxTokens);
}

type OutputTokenRequest = Pick<
  ChatCompletionParameters,
  "conversation_type" | "max_tokens" | "mode" | "options" | "reasoning_effort" | "response_format"
>;

export function resolveEffectiveMaxTokens(
  params: OutputTokenRequest,
  modelConfig: ModelConfigItem | undefined,
): number | undefined {
  return getEffectiveMaxTokens(params.max_tokens, modelConfig?.maxTokens);
}

export function resolveRequiredMaxTokens(
  params: OutputTokenRequest,
  modelConfig: ModelConfigItem | undefined,
): number {
  const maxTokens = resolveEffectiveMaxTokens(params, modelConfig) ?? modelConfig?.maxTokens;

  if (maxTokens === undefined) {
    throw new AssistantError(
      "The provider requires an output limit, but the model has no declared output capacity",
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return maxTokens;
}

export function mergeParametersWithDefaults(
  params: Partial<ChatCompletionParameters> & Pick<ChatCompletionParameters, "env">,
  defaults: Partial<ChatCompletionParameters> = {},
): ChatCompletionParameters {
  return {
    ...defaults,
    ...params,
  };
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

  const effectiveMaxTokens =
    resolveEffectiveMaxTokens(params, modelConfig) ?? modelConfig?.maxTokens;

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
    case "ultra":
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

  const effectiveMaxTokens =
    providerName === "anthropic" || providerName === "workers-ai"
      ? resolveRequiredMaxTokens(params, modelConfig)
      : resolveEffectiveMaxTokens(params, modelConfig);

  if (effectiveMaxTokens !== undefined) {
    if (providerName === "openai") {
      commonParams.max_completion_tokens = effectiveMaxTokens;
    } else {
      commonParams.max_tokens = effectiveMaxTokens;
    }
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

export interface ProviderToolSelection {
  tools?: Record<string, any>[];
  parallel_tool_calls?: boolean;
  tool_choice?: unknown;
}

export function getToolsForProvider(
  params: Pick<
    ChatCompletionParameters,
    | "model"
    | "disable_functions"
    | "response_format"
    | "tools"
    | "available_functions"
    | "parallel_tool_calls"
    | "tool_choice"
  >,
  modelConfig: Pick<
    ModelConfigItem,
    "supportsToolCalls" | "supportsParallelToolCalls" | "supportsToolChoice"
  > | null,
  providerName: string,
): ProviderToolSelection {
  if (!params.model || params.disable_functions || params.response_format) {
    return {};
  }

  if (!modelConfig?.supportsToolCalls) {
    return {};
  }

  try {
    const tools: Record<string, any>[] = [
      ...formatToolCalls(providerName, params.available_functions ?? []),
      ...(params.tools ?? []),
    ];
    const result: ProviderToolSelection = {};

    if (tools.length > 0) {
      result.tools = tools;
    }

    if (providerName !== "cohere" && modelConfig.supportsParallelToolCalls !== false) {
      result.parallel_tool_calls = params.parallel_tool_calls;
    }

    if (modelConfig.supportsToolChoice === false) {
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

export function shouldEnableStreaming(
  modelConfig: ModelConfigItem | null | undefined,
  supportsStreaming: boolean,
  stream: boolean | undefined,
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

  return Boolean(
    stream &&
    supportsStreaming &&
    modelConfig.supportsStreaming !== false &&
    modelTypeSupportsStreaming,
  );
}

export function createStreamingParameters(
  modelConfig: ModelConfigItem,
  supportsStreaming: boolean,
  stream: boolean | undefined,
  options: { includeUsage?: boolean } = {},
): Record<string, any> {
  if (!shouldEnableStreaming(modelConfig, supportsStreaming, stream)) {
    return {};
  }

  return options.includeUsage === false
    ? { stream: true }
    : { stream: true, stream_options: { include_usage: true } };
}
