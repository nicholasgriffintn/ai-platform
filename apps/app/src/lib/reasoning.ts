import type { ModelConfigItem } from "~/types";
import type { ReasoningEffort } from "~/types/chat";

export const DEFAULT_REASONING_EFFORTS: ReasoningEffort[] = ["none", "simulated-thinking"];

export function getReasoningOptions(modelConfig?: ModelConfigItem): ReasoningEffort[] {
	const configuredLevels = modelConfig?.reasoningConfig?.supportedEffortLevels;
	return configuredLevels && configuredLevels.length > 0
		? configuredLevels
		: DEFAULT_REASONING_EFFORTS;
}

export function getDefaultReasoningEffort(modelConfig?: ModelConfigItem): ReasoningEffort {
	return modelConfig?.reasoningConfig?.defaultEffort ?? "none";
}

export function hasProviderReasoningOptions(modelConfig?: ModelConfigItem): boolean {
	return (
		modelConfig?.reasoningConfig?.supportedEffortLevels?.some(
			(level) => level !== "none" && level !== "simulated-thinking",
		) ?? false
	);
}

export function formatReasoningLabel(value: ReasoningEffort): string {
	switch (value) {
		case "none":
			return "Instant";
		case "simulated-thinking":
			return "Simulated";
		case "thinking":
			return "Thinking";
		case "low":
			return "Low";
		case "medium":
			return "Medium";
		case "high":
			return "High";
		default:
			return value;
	}
}
