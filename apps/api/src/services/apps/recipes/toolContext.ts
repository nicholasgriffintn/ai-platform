import { coerceStringArray, isRecord } from "~/utils/objects";

export interface ActiveRecipeSetup {
	id: string;
	installationId?: string;
}

export function getRecipeAllowedConnectorProviders(options: unknown): string[] | null {
	if (!isRecord(options) || !isRecord(options.recipe)) {
		return null;
	}

	return coerceStringArray(options.recipe.allowedConnectorProviders);
}

export function getRecipeAllowedConnectorOperations(
	options: unknown,
	provider: string,
): string[] | null {
	if (
		!isRecord(options) ||
		!isRecord(options.recipe) ||
		!isRecord(options.recipe.allowedConnectorOperations) ||
		!(provider in options.recipe.allowedConnectorOperations)
	) {
		return null;
	}

	return coerceStringArray(options.recipe.allowedConnectorOperations[provider]);
}

export function getRecipeExecutionChannel(options: unknown): string | undefined {
	if (!isRecord(options) || !isRecord(options.recipe)) {
		return undefined;
	}

	return typeof options.recipe.channel === "string" ? options.recipe.channel : undefined;
}

export function getRecipeConfiguration(options: unknown): Record<string, unknown> | undefined {
	if (!isRecord(options) || !isRecord(options.recipe) || !isRecord(options.recipe.configuration)) {
		return undefined;
	}

	return options.recipe.configuration;
}

export function getActiveRecipeSetup(options: unknown): ActiveRecipeSetup | undefined {
	if (!isRecord(options) || !isRecord(options.recipe) || typeof options.recipe.id !== "string") {
		return undefined;
	}

	return {
		id: options.recipe.id,
		installationId:
			typeof options.recipe.installationId === "string" ? options.recipe.installationId : undefined,
	};
}

export function getTriggerRecipeChannel(options: unknown): "sms" | "tool" {
	if (!isRecord(options)) {
		return "tool";
	}

	if (options.source === "sms") {
		return "sms";
	}

	if (isRecord(options.sms) && options.sms.enabled === true) {
		return "sms";
	}

	return "tool";
}

export function getSmsRecipeExecutionContext(
	options: unknown,
): { from?: string; to?: string } | undefined {
	if (!isRecord(options) || !isRecord(options.sms) || options.sms.enabled !== true) {
		return undefined;
	}

	return {
		...(typeof options.sms.from === "string" ? { from: options.sms.from } : {}),
		...(typeof options.sms.to === "string" ? { to: options.sms.to } : {}),
	};
}
