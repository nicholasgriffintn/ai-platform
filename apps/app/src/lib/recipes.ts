import type {
	AssistantRecipe,
	RecipeConfiguration,
	RecipeConfigurationField,
	RecipeInstallation,
	RecipeInstallationTrigger,
	RecipeKind,
} from "@assistant/schemas";
import { isSupportedCronExpression } from "@assistant/schemas";

export type RecipeKindFilter = RecipeKind | "all";
export type ConfigurationFormValues = Record<string, string | boolean>;

export const recipeKindLabels: Record<RecipeKindFilter, string> = {
	all: "All recipes",
	automate: "Automations",
	integrate: "Integrations",
};

export function getRecipeIntegrationStatusLabel(status: string | undefined) {
	if (status === "connected") return "Connected";
	if (status === "not_required") return "Built in";
	if (status === "missing") return "Connect";
	if (status === "unconfigured") return "Unavailable";
	return "Unknown";
}

export function getMissingRecipeIntegrations(recipe: AssistantRecipe) {
	return recipe.integrations.filter(
		(integration) =>
			integration.requiresConnection &&
			(integration.connectionStatus === "missing" ||
				integration.connectionStatus === "unknown" ||
				integration.connectionStatus === "unconfigured"),
	);
}

export function isRecipeReady(recipe: AssistantRecipe) {
	return recipe.integrations.every(
		(integration) =>
			integration.connectionStatus === "connected" ||
			integration.connectionStatus === "not_required",
	);
}

export function formatRecipeConfigurationValue(
	field: RecipeConfigurationField,
	configuration: RecipeConfiguration,
): string | boolean {
	const value = configuration[field.key] ?? field.defaultValue;
	if (field.type === "boolean") {
		return typeof value === "boolean" ? value : false;
	}
	if (field.type === "string_list") {
		return Array.isArray(value) ? value.join("\n") : "";
	}
	if (typeof value === "number") {
		return String(value);
	}
	return typeof value === "string" ? value : "";
}

export function buildRecipeConfigurationFromFields(
	fields: RecipeConfigurationField[],
	values: ConfigurationFormValues,
): RecipeConfiguration {
	const configuration: RecipeConfiguration = {};

	for (const field of fields) {
		const value = values[field.key];
		if (field.type === "boolean") {
			configuration[field.key] = value === true;
			continue;
		}
		if (typeof value !== "string") {
			continue;
		}

		const trimmedValue = value.trim();
		if (!trimmedValue) {
			continue;
		}

		if (field.type === "number") {
			const numberValue = Number(trimmedValue);
			if (Number.isFinite(numberValue)) {
				configuration[field.key] = numberValue;
			}
			continue;
		}
		if (field.type === "string_list") {
			const listValue = trimmedValue
				.split(/[,\n]/)
				.map((item) => item.trim())
				.filter(Boolean);
			if (listValue.length > 0) {
				configuration[field.key] = listValue;
			}
			continue;
		}

		configuration[field.key] = trimmedValue;
	}

	return configuration;
}

export function isRequiredRecipeConfigurationMissing(
	fields: RecipeConfigurationField[],
	values: ConfigurationFormValues,
) {
	return fields.some((field) => {
		if (!field.required) {
			return false;
		}
		const value = values[field.key];
		return field.type === "boolean" ? value !== true : typeof value !== "string" || !value.trim();
	});
}

function isRecipeConfigurationFieldMissing(
	field: RecipeConfigurationField,
	configuration: RecipeConfiguration,
) {
	const value = configuration[field.key] ?? field.defaultValue;
	if (field.type === "boolean") {
		return value !== true;
	}
	if (field.type === "number") {
		return typeof value !== "number" || !Number.isFinite(value);
	}
	if (field.type === "string_list") {
		return !Array.isArray(value) || value.map((item) => item.trim()).filter(Boolean).length === 0;
	}

	return typeof value !== "string" || !value.trim();
}

export function getMissingRequiredRecipeConfigurationFields(
	recipe: AssistantRecipe,
	installation?: RecipeInstallation,
) {
	const configuration = installation?.configuration ?? {};
	return recipe.configurationFields.filter(
		(field) => field.required && isRecipeConfigurationFieldMissing(field, configuration),
	);
}

export function hasSavedRecipeConfiguration(installation?: RecipeInstallation) {
	return Boolean(
		installation?.configuration &&
		Object.values(installation.configuration).some((value) => value !== null && value !== ""),
	);
}

export function recipeSupportsSchedule(recipe: AssistantRecipe) {
	return recipe.triggers.some((trigger) => trigger.type === "schedule");
}

export function getRecipeScheduleTrigger(installation?: RecipeInstallation) {
	return installation?.triggers.find(
		(trigger): trigger is RecipeInstallationTrigger & { type: "schedule" } =>
			trigger.type === "schedule",
	);
}

export function isRecipeScheduleCronSupported(cronExpression: string) {
	return cronExpression.trim().length > 0 && isSupportedCronExpression(cronExpression);
}
