import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ChatCompletionParameters } from "~/types";
import { calculateReasoningBudget, resolveRequiredMaxTokens } from "~/utils/parameters";

import {
  resolveAdaptiveThinkingEffort,
  shouldEnableProviderThinking,
  usesAdaptiveThinkingApi,
  usesBudgetThinkingApi,
} from "../models/reasoning";

const MINIMUM_THINKING_BUDGET = 1024;

export interface BedrockReasoningRequest {
  additionalModelRequestFields?: Record<string, unknown>;
  allowsSampling: boolean;
  maxTokens?: number;
}

function resolveThinkingBudget(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
  maxTokens: number,
): number | undefined {
  const budgetCeiling = maxTokens - 1;

  if (budgetCeiling < MINIMUM_THINKING_BUDGET) {
    return undefined;
  }

  return Math.min(calculateReasoningBudget(params, modelConfig), budgetCeiling);
}

export function buildBedrockReasoningRequest(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
): BedrockReasoningRequest {
  if (!shouldEnableProviderThinking(modelConfig, params.reasoning_effort)) {
    return { allowsSampling: true };
  }

  if (usesAdaptiveThinkingApi(modelConfig)) {
    const effort = resolveAdaptiveThinkingEffort(modelConfig, params.reasoning_effort);

    return {
      allowsSampling: false,
      additionalModelRequestFields: {
        thinking: { type: "adaptive" },
        ...(effort ? { output_config: { effort } } : {}),
      },
    };
  }

  if (!usesBudgetThinkingApi(modelConfig)) {
    return { allowsSampling: true };
  }

  const maxTokens = resolveRequiredMaxTokens(params, modelConfig);
  const budgetTokens = resolveThinkingBudget(params, modelConfig, maxTokens);

  if (budgetTokens === undefined) {
    return { allowsSampling: true };
  }

  return {
    allowsSampling: true,
    maxTokens,
    additionalModelRequestFields: {
      thinking: { type: "enabled", budget_tokens: budgetTokens },
    },
  };
}
