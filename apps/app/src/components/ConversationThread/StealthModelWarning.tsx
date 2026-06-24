import type { ModelConfigItem } from "@assistant/schemas";
import { isStealthModel } from "~/lib/models";

interface StealthModelWarningProps {
	model?: ModelConfigItem;
}

export const STEALTH_MODEL_WARNING =
	"Note: Prompts and completions may be logged by the provider and used to improve the model.";

export function StealthModelWarning({ model }: StealthModelWarningProps) {
	if (!isStealthModel(model)) {
		return null;
	}

	return (
		<div className="mb-4 rounded-md border border-amber-300 bg-amber-100 p-3 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
			{STEALTH_MODEL_WARNING}
		</div>
	);
}
