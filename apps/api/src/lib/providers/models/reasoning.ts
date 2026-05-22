import type { ModelConfigItem, ReasoningEffortLevel } from "~/types";

const PROVIDER_REASONING_EFFORTS = new Set<ReasoningEffortLevel>(["low", "medium", "high"]);
const PROMPT_ONLY_REASONING_EFFORTS = new Set<ReasoningEffortLevel>(["none", "simulated-thinking"]);

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
			(level) => !PROMPT_ONLY_REASONING_EFFORTS.has(level),
		) ?? false
	);
}

export function shouldSendProviderReasoningEffort(
	modelConfig: ModelConfigItem | undefined,
	reasoningEffort: ReasoningEffortLevel | undefined,
): reasoningEffort is Exclude<ReasoningEffortLevel, "none" | "simulated-thinking" | "thinking"> {
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
		!PROMPT_ONLY_REASONING_EFFORTS.has(reasoningEffort) &&
		isConfiguredReasoningEffort(modelConfig, reasoningEffort)
	);
}

export function resolveReasoningModel(
	modelConfig: ModelConfigItem | undefined,
	reasoningEffort: ReasoningEffortLevel | undefined,
): string | undefined {
	if (!reasoningEffort || PROMPT_ONLY_REASONING_EFFORTS.has(reasoningEffort)) {
		return undefined;
	}

	if (!isConfiguredReasoningEffort(modelConfig, reasoningEffort)) {
		return undefined;
	}

	return modelConfig?.reasoningConfig?.modelOverrides?.[reasoningEffort];
}
