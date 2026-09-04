import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ReasoningEffortLevel } from "~/types";

const PROVIDER_REASONING_EFFORTS = new Set<ReasoningEffortLevel>([
  "default",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
]);
const NON_THINKING_REASONING_EFFORTS = new Set<ReasoningEffortLevel>([
  "none",
  "simulated-thinking",
]);

export type AdaptiveThinkingEffort = Extract<
  ReasoningEffortLevel,
  "low" | "medium" | "high" | "xhigh" | "max"
>;

const ADAPTIVE_THINKING_EFFORTS: readonly ReasoningEffortLevel[] = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

function isAdaptiveThinkingEffort(
  reasoningEffort: ReasoningEffortLevel,
): reasoningEffort is AdaptiveThinkingEffort {
  return ADAPTIVE_THINKING_EFFORTS.includes(reasoningEffort);
}

export function isConfiguredReasoningEffort(
  modelConfig: ModelConfigItem | undefined,
  reasoningEffort: ReasoningEffortLevel | undefined,
): reasoningEffort is ReasoningEffortLevel {
  if (!reasoningEffort) {
    return false;
  }

  return modelConfig?.reasoningConfig?.supportedEffortLevels?.includes(reasoningEffort) ?? false;
}

export function hasProviderReasoningOptions(modelConfig: ModelConfigItem | undefined): boolean {
  return (
    modelConfig?.reasoningConfig?.supportedEffortLevels?.some(
      (level) => !NON_THINKING_REASONING_EFFORTS.has(level),
    ) ?? false
  );
}

export function shouldSendProviderReasoningEffort(
  modelConfig: ModelConfigItem | undefined,
  reasoningEffort: ReasoningEffortLevel | undefined,
): reasoningEffort is Exclude<ReasoningEffortLevel, "simulated-thinking" | "thinking"> {
  if (!reasoningEffort || !PROVIDER_REASONING_EFFORTS.has(reasoningEffort)) {
    return false;
  }

  return isConfiguredReasoningEffort(modelConfig, reasoningEffort);
}

export function shouldEnableProviderThinking(
  modelConfig: ModelConfigItem | undefined,
  reasoningEffort: ReasoningEffortLevel | undefined,
): boolean {
  return (
    !!reasoningEffort &&
    !NON_THINKING_REASONING_EFFORTS.has(reasoningEffort) &&
    isConfiguredReasoningEffort(modelConfig, reasoningEffort)
  );
}

export function usesAdaptiveThinkingApi(modelConfig: ModelConfigItem | undefined): boolean {
  return modelConfig?.reasoningConfig?.thinkingApi === "adaptive";
}

export function usesBudgetThinkingApi(modelConfig: ModelConfigItem | undefined): boolean {
  return modelConfig?.reasoningConfig?.thinkingApi === "budget";
}

export function resolveAdaptiveThinkingEffort(
  modelConfig: ModelConfigItem | undefined,
  reasoningEffort: ReasoningEffortLevel | undefined,
): AdaptiveThinkingEffort | undefined {
  if (!reasoningEffort || !isAdaptiveThinkingEffort(reasoningEffort)) {
    return undefined;
  }

  return isConfiguredReasoningEffort(modelConfig, reasoningEffort) ? reasoningEffort : undefined;
}

export function resolveReasoningModel(
  modelConfig: ModelConfigItem | undefined,
  reasoningEffort: ReasoningEffortLevel | undefined,
): string | undefined {
  if (!reasoningEffort || NON_THINKING_REASONING_EFFORTS.has(reasoningEffort)) {
    return undefined;
  }

  if (!isConfiguredReasoningEffort(modelConfig, reasoningEffort)) {
    return undefined;
  }

  return modelConfig?.reasoningConfig?.modelOverrides?.[reasoningEffort];
}
