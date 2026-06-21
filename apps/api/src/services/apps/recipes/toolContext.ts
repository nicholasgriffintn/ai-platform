import { parseChatRequestOptions, readRecipeChatRequestOptions } from "@assistant/schemas";

export interface ActiveRecipeSetup {
	id: string;
	installationId?: string;
}

export function getRecipeAllowedConnectorProviders(options: unknown): string[] | null {
	const recipe = readRecipeChatRequestOptions(options);
	if (!recipe) {
		return null;
	}

	return recipe.allowedConnectorProviders ?? [];
}

export function getRecipeAllowedConnectorOperations(
	options: unknown,
	provider: string,
): string[] | null {
	const operations = readRecipeChatRequestOptions(options)?.allowedConnectorOperations;
	if (!operations || !(provider in operations)) {
		return null;
	}

	return operations[provider] ?? [];
}

export function getRecipeExecutionChannel(options: unknown): string | undefined {
	return readRecipeChatRequestOptions(options)?.channel;
}

export function getRecipeConfiguration(options: unknown): Record<string, unknown> | undefined {
	return readRecipeChatRequestOptions(options)?.configuration;
}

export function getActiveRecipeSetup(options: unknown): ActiveRecipeSetup | undefined {
	const recipe = readRecipeChatRequestOptions(options);
	if (!recipe) {
		return undefined;
	}

	return {
		id: recipe.id,
		installationId: recipe.installationId,
	};
}

export function getTriggerRecipeChannel(options: unknown): "sms" | "tool" {
	const requestOptions = parseChatRequestOptions(options);
	if (requestOptions?.source === "sms") {
		return "sms";
	}

	if (requestOptions?.sms?.enabled === true) {
		return "sms";
	}

	return "tool";
}

export function getSmsRecipeExecutionContext(
	options: unknown,
): { from?: string; to?: string } | undefined {
	const sms = parseChatRequestOptions(options)?.sms;
	if (sms?.enabled !== true) {
		return undefined;
	}

	return {
		...(sms.from ? { from: sms.from } : {}),
		...(sms.to ? { to: sms.to } : {}),
	};
}
