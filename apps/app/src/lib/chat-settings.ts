import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";
import type { ChatSettings } from "~/types";
import { getDefaultReasoningEffort } from "./reasoning";
import { getDefaultVerbosity } from "./verbosity";

export function applyModelResponseDefaults(
	settings: ChatSettings,
	modelConfig?: ModelConfigItem,
): ChatSettings {
	return {
		...settings,
		reasoning: {
			...settings.reasoning,
			effort: getDefaultReasoningEffort(modelConfig),
		},
		verbosity: getDefaultVerbosity(modelConfig),
	};
}
