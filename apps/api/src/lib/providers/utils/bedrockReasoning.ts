import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ChatCompletionParameters } from "~/types";
import { calculateReasoningBudget, resolveEffectiveMaxTokens } from "~/utils/parameters";

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
}

function resolveThinkingBudget(
  params: ChatCompletionParameters,
  modelConfig: ModelConfigItem,
): number | undefined {
  const budgetCeiling = resolveEffectiveMaxTokens(params, modelConfig) - 1;

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

  const budgetTokens = resolveThinkingBudget(params, modelConfig);

  if (budgetTokens === undefined) {
    return { allowsSampling: true };
  }

  return {
    allowsSampling: true,
    additionalModelRequestFields: {
      thinking: { type: "enabled", budget_tokens: budgetTokens },
    },
  };
}
