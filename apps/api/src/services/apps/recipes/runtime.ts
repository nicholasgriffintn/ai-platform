import type {
	AssistantRecipe,
	AssistantRecipeConnection,
	RecipeConfiguration,
	RecipeConfigurationField,
	RecipeConnectorProvider,
	RecipeInstallation,
} from "@assistant/schemas";
import { recipeConnectorProviderSchema } from "@assistant/schemas";

import { isConnectorOperationSupported } from "~/lib/providers/capabilities/connectors";
import { RECIPE_LOOKUP_TOOL, RECIPE_SETUP_TOOL } from "./catalog/shared";

export interface RecipeRuntimeContext {
	allowedConnectorOperations: Record<string, string[]>;
	allowedConnectorProviders: RecipeConnectorProvider[];
	checklist?: string[];
	conversationStarter: string;
	enabledTools: string[];
	messageUrl: string;
}

export function buildRecipeConnections(recipe: AssistantRecipe): AssistantRecipeConnection[] {
	return recipe.integrations.map((integration) => ({
		integrationId: integration.id,
		providerId: integration.providerId,
		name: integration.name,
		status: integration.connectionStatus ?? "unknown",
		requiresConnection: integration.requiresConnection,
		setupUrl: integration.setupUrl,
	}));
}

export function getBlockingConnections(connections: AssistantRecipeConnection[]) {
	return connections.filter(
		(connection) =>
			connection.requiresConnection &&
			(connection.status === "missing" ||
				connection.status === "unknown" ||
				connection.status === "unconfigured"),
	);
}

export function isRequiredRecipeConfigurationValueMissing(
	field: RecipeConfigurationField,
	value: RecipeConfiguration[string] | undefined,
) {
	const resolvedValue = value ?? field.defaultValue;
	if (field.type === "boolean") {
		return resolvedValue !== true;
	}
	if (field.type === "number") {
		return typeof resolvedValue !== "number" || !Number.isFinite(resolvedValue);
	}
	if (field.type === "string_list") {
		return (
			!Array.isArray(resolvedValue) ||
			resolvedValue.map((item) => item.trim()).filter(Boolean).length === 0
		);
	}

	return typeof resolvedValue !== "string" || !resolvedValue.trim();
}

export function buildRecipeSetupRuntime(params: {
	recipe: AssistantRecipe;
	connections: AssistantRecipeConnection[];
	configuration?: RecipeConfiguration;
}): RecipeRuntimeContext {
	const enabledTools = Array.from(
		new Set([...params.recipe.enabledTools, RECIPE_LOOKUP_TOOL, RECIPE_SETUP_TOOL]),
	);
	const conversationStarter = createConversationStarter({
		recipe: params.recipe,
		connections: params.connections,
		enabledTools,
		configuration: params.configuration,
	});

	return {
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, enabledTools),
		checklist: buildRecipeChecklist(params.recipe, params.connections, enabledTools),
		enabledTools,
		allowedConnectorProviders: buildAllowedConnectorProviders(params.recipe),
		allowedConnectorOperations: buildAllowedConnectorOperations(params.recipe),
	};
}

export function buildRecipeInvocationRuntime(params: {
	recipe: AssistantRecipe;
	connections: AssistantRecipeConnection[];
	installation: RecipeInstallation | null;
	input?: string;
	configuration?: RecipeConfiguration;
}): RecipeRuntimeContext {
	const enabledTools = Array.from(new Set(params.recipe.enabledTools));
	const prompt = params.installation
		? buildRecipeInvocationPrompt({
				recipe: params.recipe,
				installation: params.installation,
				input: params.input,
			})
		: params.recipe.setupPrompt;
	const conversationStarter = createConversationStarter({
		recipe: params.recipe,
		connections: params.connections,
		enabledTools,
		configuration: params.configuration,
		prompt,
	});

	return {
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, enabledTools),
		enabledTools,
		allowedConnectorProviders: buildAllowedConnectorProviders(params.recipe),
		allowedConnectorOperations: buildAllowedConnectorOperations(params.recipe),
	};
}

function buildAllowedConnectorProviders(recipe: AssistantRecipe): RecipeConnectorProvider[] {
	const providers = new Set<RecipeConnectorProvider>();
	for (const integration of recipe.integrations) {
		const parsed = recipeConnectorProviderSchema.safeParse(integration.providerId);
		if (parsed.success && parsed.data !== "github") {
			providers.add(parsed.data);
		}
	}

	return Array.from(providers);
}

function buildAllowedConnectorOperations(recipe: AssistantRecipe): Record<string, string[]> {
	const operationsByProvider = new Map<RecipeConnectorProvider, Set<string>>();

	for (const integration of recipe.integrations) {
		const parsed = recipeConnectorProviderSchema.safeParse(integration.providerId);
		if (!parsed.success || parsed.data === "github") {
			continue;
		}

		for (const operationId of integration.operationIds ?? []) {
			if (!isConnectorOperationSupported(parsed.data, operationId)) {
				continue;
			}

			const operations = operationsByProvider.get(parsed.data) ?? new Set<string>();
			operations.add(operationId);
			operationsByProvider.set(parsed.data, operations);
		}
	}

	return Object.fromEntries(
		Array.from(operationsByProvider.entries()).map(([provider, operations]) => [
			provider,
			Array.from(operations),
		]),
	);
}

function buildRecipeChecklist(
	recipe: AssistantRecipe,
	connections: AssistantRecipeConnection[],
	enabledTools = recipe.enabledTools,
) {
	const blockingConnections = getBlockingConnections(connections).map(
		(connection) => connection.name,
	);

	return [
		"Confirm the goal and target",
		blockingConnections.length > 0
			? `Connect or verify ${blockingConnections.join(", ")}`
			: connections.length > 0
				? "Review the connected integrations"
				: "Review the recipe setup",
		enabledTools.length > 0
			? `Enable ${enabledTools.join(", ")} for this conversation`
			: "Use normal chat without extra tools",
		"Ask for confirmation before external writes",
	];
}

function isRecipeConfigurationValuePresent(
	field: RecipeConfigurationField,
	value: RecipeConfiguration[string] | undefined,
): boolean {
	return !isRequiredRecipeConfigurationValueMissing(field, value);
}

function formatRecipeConfigurationValue(value: RecipeConfiguration[string]): string {
	if (Array.isArray(value)) {
		return value.join(", ");
	}

	return String(value);
}

function buildRecipeConfigurationContext(
	recipe: AssistantRecipe,
	configuration: RecipeConfiguration | undefined,
): string {
	if (!configuration) {
		return "";
	}

	const savedFields = recipe.configurationFields.filter((field) =>
		isRecipeConfigurationValuePresent(field, configuration[field.key]),
	);
	const missingRequiredFields = recipe.configurationFields.filter(
		(field) =>
			field.required && !isRecipeConfigurationValuePresent(field, configuration[field.key]),
	);
	const missingOptionalFields = recipe.configurationFields.filter(
		(field) =>
			!field.required && !isRecipeConfigurationValuePresent(field, configuration[field.key]),
	);
	const lines: string[] = [];

	if (savedFields.length > 0) {
		lines.push(
			"Saved recipe configuration:",
			...savedFields.map(
				(field) =>
					`- ${field.label} (${field.key}): ${formatRecipeConfigurationValue(
						configuration[field.key],
					)}`,
			),
			"Use saved recipe configuration as defaults. Do not ask me to reconfirm saved configuration values.",
		);
	}

	if (missingRequiredFields.length === 0 && savedFields.length > 0) {
		lines.push("This recipe is already configured.");
	} else if (missingRequiredFields.length > 0) {
		lines.push(
			`Missing required recipe configuration: ${missingRequiredFields
				.map((field) => field.label)
				.join(", ")}.`,
		);
	}

	if (missingOptionalFields.length > 0) {
		lines.push(
			`Missing optional recipe configuration: ${missingOptionalFields
				.map((field) => field.label)
				.join(", ")}. Ask for optional values only when the current request needs them.`,
		);
	}

	return lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
}

function createConversationStarter(params: {
	recipe: AssistantRecipe;
	connections: AssistantRecipeConnection[];
	input?: string;
	enabledTools?: string[];
	configuration?: RecipeConfiguration;
	prompt?: string;
}) {
	const enabledTools = params.enabledTools ?? params.recipe.enabledTools;
	const prompt = params.prompt ?? params.recipe.setupPrompt;
	const connectionSection =
		params.connections.length > 0
			? `\nConnector status:\n${params.connections
					.map((connection) => `- ${connection.name}: ${connection.status.replace("_", " ")}`)
					.join("\n")}\n`
			: "";
	const toolLine = enabledTools.length > 0 ? enabledTools.join(", ") : "no extra tools";
	const inputLine = params.input?.trim() ? `\nTrigger input:\n${params.input.trim()}\n` : "";
	const configurationContext = buildRecipeConfigurationContext(params.recipe, params.configuration);
	const contextInstruction = enabledTools.includes(RECIPE_LOOKUP_TOOL)
		? `\nUse ${RECIPE_LOOKUP_TOOL} only when recipe configuration is missing from this message, trigger details are unavailable, notification availability is unknown, field keys are unclear, or the setup contract is genuinely needed. Do not call ${RECIPE_LOOKUP_TOOL} just to restate saved configuration already shown in the conversation. Do not save SMS notification triggers unless ${RECIPE_LOOKUP_TOOL} says SMS notifications are available.\n`
		: "";
	const setupToolInstruction = enabledTools.includes(RECIPE_SETUP_TOOL)
		? `\nWhen I confirm setup changes or ask you to choose sensible defaults, use the available context and tools, then use ${RECIPE_SETUP_TOOL} to save recipe configuration and triggers before saying setup is complete. Do not save unchanged configuration just to reconfirm it.\n`
		: "";

	return `${prompt}${inputLine}${configurationContext}${connectionSection ? `\n${connectionSection}` : ""}

Enabled tools for this conversation: ${toolLine}.${contextInstruction}${setupToolInstruction}

Use only the enabled tools, connected integrations, and recipe context available to this conversation. If a required connector is missing, unknown, or unconfigured, ask me to connect it before taking external actions. Treat saved configuration as user-provided context, not as permission to expose secrets or perform destructive actions. Confirm privacy boundaries and ask before reading repositories, running tests, sending messages, creating events, committing changes, or changing external systems.`;
}

function getSavedSchedulePrompt(installation: RecipeInstallation | null): string | undefined {
	return installation?.triggers.find(
		(trigger) => trigger.type === "schedule" && trigger.enabled !== false && trigger.prompt?.trim(),
	)?.prompt;
}

function buildRecipeInvocationPrompt(params: {
	recipe: AssistantRecipe;
	installation: RecipeInstallation | null;
	input?: string;
}): string {
	const input = params.input?.trim();
	if (input) {
		return input;
	}

	const scheduledPrompt = getSavedSchedulePrompt(params.installation)?.trim();
	if (scheduledPrompt) {
		return scheduledPrompt;
	}

	return `Run the ${params.recipe.title} recipe now using saved configuration. Produce the recipe result, not setup instructions.`;
}

export function createRecipeMessageUrl(setupPrompt: string, enabledTools: string[] = []) {
	const params = new URLSearchParams({ query: setupPrompt });
	if (enabledTools.length > 0) {
		params.set("enabled_tools", enabledTools.join(","));
	}

	return `/?${params.toString()}`;
}
