import type { ModelConfigItem, VerbosityLevel } from "~/types";

const PROVIDER_VERBOSITY_LEVELS = new Set<VerbosityLevel>(["low", "medium", "high"]);

export function shouldSendProviderVerbosity(
	modelConfig: ModelConfigItem | undefined,
	verbosity: VerbosityLevel | undefined,
): verbosity is Exclude<VerbosityLevel, "caveman"> {
	if (!verbosity || !PROVIDER_VERBOSITY_LEVELS.has(verbosity)) {
		return false;
	}

	return modelConfig?.verbosityConfig?.supportedVerbosityLevels?.includes(verbosity) ?? false;
}
