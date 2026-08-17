import { type VerbosityLevel } from "@ngriffin_uk/polychat-library-chat/conversation-types";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

export const DEFAULT_VERBOSITY_LEVELS: VerbosityLevel[] = ["low", "medium", "high"];
export const CAVEMAN_VERBOSITY: VerbosityLevel = "caveman";

export function getVerbosityOptions(modelConfig?: ModelConfigItem): VerbosityLevel[] {
	const configuredLevels = modelConfig?.verbosityConfig?.supportedVerbosityLevels;
	const baseLevels =
		configuredLevels && configuredLevels.length > 0 ? configuredLevels : DEFAULT_VERBOSITY_LEVELS;

	return baseLevels.includes(CAVEMAN_VERBOSITY) ? baseLevels : [...baseLevels, CAVEMAN_VERBOSITY];
}

export function getDefaultVerbosity(modelConfig?: ModelConfigItem): VerbosityLevel {
	return modelConfig?.verbosityConfig?.defaultVerbosity ?? "medium";
}

export function formatVerbosityLabel(value: VerbosityLevel): string {
	switch (value) {
		case "low":
			return "Low";
		case "medium":
			return "Medium";
		case "high":
			return "High";
		case "caveman":
			return "Caveman";
		default:
			return value;
	}
}
