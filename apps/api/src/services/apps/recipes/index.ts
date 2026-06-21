import type {
	AssistantRecipe,
	AssistantRecipeConnection,
	RecipeConfigurationField,
	RecipeConfiguration,
	RecipeConnectionStatus,
	RecipeConnectorProvider,
	RecipeInstallation,
	RecipeInstallationTrigger,
	RecipeInstallationUpdateRequest,
} from "@assistant/schemas";
import { recipeConfigurationSchema, recipeConnectorProviderSchema } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { isConnectorOperationSupported } from "~/lib/providers/capabilities/connectors";
import { TaskService } from "~/services/tasks/TaskService";
import { isSupportedCronExpression } from "~/utils/cron";
import { safeParseJson } from "~/utils/json";
import { AssistantError, ErrorType } from "~/utils/errors";
import { listRecipeConnectors } from "../connectors";
import {
	assistantRecipes,
	recipeCategories,
	recipeFilters,
	RECIPE_LOOKUP_TOOL,
	RECIPE_SETUP_TOOL,
} from "./catalog";
import { matchInstalledRecipe } from "./matching";
import { buildRecipeScheduleState, type RecipeScheduleState } from "./scheduleState";

export const RECIPE_INSTALLATION_APP_ID = "assistant_recipe_installation";
export const RECIPE_INSTALLATION_ITEM_TYPE = "recipe_installation";

interface RecipeListOptions {
	context?: ServiceContext;
	userId?: number;
	requestUrl?: string;
}

interface RecipeInstallOptions extends RecipeListOptions {
	channel: "web" | "ios" | "sms";
	triggers?: RecipeInstallationTrigger[];
	configuration?: RecipeConfiguration;
}

interface RecipeConnectionContext {
	statusByProviderId: Map<string, RecipeConnectionStatus>;
	setupUrlByProviderId: Map<string, string | undefined>;
}

interface StoredRecipeInstallationData {
	recipeId: string;
	status: "active" | "paused";
	triggers: RecipeInstallationTrigger[];
	configuration?: RecipeConfiguration;
	scheduleState?: RecipeScheduleState;
}

interface RecipeInstallationRecord {
	id: string;
	user_id: number;
	app_id?: string;
	item_id?: string;
	item_type?: string;
	data: string;
	created_at: string;
	updated_at: string;
}

export function getRecipeById(id: string) {
	return assistantRecipes.find((recipe) => recipe.id === id);
}

async function getRecipeConnectionContext({
	context,
	userId,
	requestUrl,
}: RecipeListOptions): Promise<RecipeConnectionContext> {
	const statusByProviderId = new Map<string, RecipeConnectionStatus>();
	const setupUrlByProviderId = new Map<string, string | undefined>();

	if (!context || !userId) {
		return { statusByProviderId, setupUrlByProviderId };
	}

	const { connectors } = await listRecipeConnectors({ context, userId, requestUrl });
	for (const connector of connectors) {
		statusByProviderId.set(
			connector.id,
			connector.status === "connected"
				? "connected"
				: connector.status === "unconfigured"
					? "unconfigured"
					: "missing",
		);
		setupUrlByProviderId.set(connector.id, connector.authorizationUrl || connector.setupUrl);
	}

	return { statusByProviderId, setupUrlByProviderId };
}

function getConnectionStatus(
	providerId: string,
	requiresConnection: boolean,
	connectionContext: RecipeConnectionContext,
): RecipeConnectionStatus {
	if (!requiresConnection) {
		return "not_required";
	}

	return connectionContext.statusByProviderId.get(providerId) ?? "unknown";
}

function enrichRecipe(
	recipe: AssistantRecipe,
	connectionContext: RecipeConnectionContext,
): AssistantRecipe {
	return {
		...recipe,
		integrations: recipe.integrations.map((integration) => {
			const connectionStatus = getConnectionStatus(
				integration.providerId,
				integration.requiresConnection,
				connectionContext,
			);

			return {
				...integration,
				connectionStatus,
				setupUrl:
					connectionStatus === "missing" || connectionStatus === "unconfigured"
						? connectionContext.setupUrlByProviderId.get(integration.providerId)
						: undefined,
			};
		}),
	};
}

function buildRecipeConnections(recipe: AssistantRecipe): AssistantRecipeConnection[] {
	return recipe.integrations.map((integration) => ({
		integrationId: integration.id,
		providerId: integration.providerId,
		name: integration.name,
		status: integration.connectionStatus ?? "unknown",
		requiresConnection: integration.requiresConnection,
		setupUrl: integration.setupUrl,
	}));
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

function getBlockingConnections(connections: AssistantRecipeConnection[]) {
	return connections.filter(
		(connection) =>
			connection.requiresConnection &&
			(connection.status === "missing" ||
				connection.status === "unknown" ||
				connection.status === "unconfigured"),
	);
}

function getUnavailableConnections(connections: AssistantRecipeConnection[]) {
	return connections.filter(
		(connection) => connection.requiresConnection && connection.status === "unconfigured",
	);
}

function assertNoUnavailableConnections(
	recipe: AssistantRecipe,
	connections: AssistantRecipeConnection[],
	action: string,
) {
	const unavailableConnections = getUnavailableConnections(connections);
	if (unavailableConnections.length === 0) {
		return;
	}

	throw new AssistantError(
		`${recipe.title} cannot be ${action} because these connectors are unavailable: ${unavailableConnections
			.map((connection) => connection.name)
			.join(", ")}`,
		ErrorType.PARAMS_ERROR,
		400,
	);
}

function validateRecipeInstallationTriggers(
	recipe: AssistantRecipe,
	triggers: readonly RecipeInstallationTrigger[],
) {
	const supportedRecipeTriggers = new Set(recipe.triggers.map((trigger) => trigger.type));

	for (const trigger of triggers) {
		if (trigger.type === "schedule" && !supportedRecipeTriggers.has("schedule")) {
			throw new AssistantError(
				`${recipe.title} does not support scheduled triggers`,
				ErrorType.PARAMS_ERROR,
				400,
			);
		}

		if (
			trigger.type === "schedule" &&
			trigger.cronExpression &&
			!isSupportedCronExpression(trigger.cronExpression)
		) {
			throw new AssistantError(
				`${recipe.title} schedule uses an unsupported cron expression`,
				ErrorType.PARAMS_ERROR,
				400,
			);
		}

		if (trigger.type === "natural_language" && !supportedRecipeTriggers.has("message")) {
			throw new AssistantError(
				`${recipe.title} does not support natural language triggers`,
				ErrorType.PARAMS_ERROR,
				400,
			);
		}
	}
}

function hasEnabledScheduleTrigger(triggers: readonly RecipeInstallationTrigger[]) {
	return triggers.some((trigger) => trigger.type === "schedule" && trigger.enabled !== false);
}

function isRequiredRecipeConfigurationValueMissing(
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

function validateScheduledRecipeConfiguration(params: {
	recipe: AssistantRecipe;
	triggers: readonly RecipeInstallationTrigger[];
	configuration: RecipeConfiguration;
}) {
	if (!hasEnabledScheduleTrigger(params.triggers)) {
		return;
	}

	const missingFields = params.recipe.configurationFields.filter(
		(field) =>
			field.required &&
			isRequiredRecipeConfigurationValueMissing(field, params.configuration[field.key]),
	);
	if (missingFields.length === 0) {
		return;
	}

	throw new AssistantError(
		`${params.recipe.title} scheduled triggers require recipe configuration: ${missingFields
			.map((field) => field.label)
			.join(", ")}`,
		ErrorType.PARAMS_ERROR,
		400,
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

function normaliseRecipeConfiguration(value: unknown): RecipeConfiguration {
	const parsed = recipeConfigurationSchema.safeParse(value);
	return parsed.success ? parsed.data : {};
}

function normaliseConfigurationValue(
	field: RecipeConfigurationField,
	value: RecipeConfiguration[string] | undefined,
): RecipeConfiguration[string] | undefined {
	if (value === undefined || value === null || value === "") {
		return field.defaultValue;
	}

	if (field.type === "number") {
		return typeof value === "number" && Number.isFinite(value) ? value : field.defaultValue;
	}
	if (field.type === "boolean") {
		return typeof value === "boolean" ? value : field.defaultValue;
	}
	if (field.type === "string_list") {
		const items = Array.isArray(value)
			? value
			: typeof value === "string"
				? value.split(/[\n,;]+/)
				: [];

		return items.length > 0
			? items
					.map((item) => item.trim())
					.filter(Boolean)
					.slice(0, 50)
			: field.defaultValue;
	}
	if (typeof value === "string") {
		return value.trim() || field.defaultValue;
	}

	return field.defaultValue;
}

function normaliseRecipeConfigurationForRecipe(
	recipe: AssistantRecipe | undefined,
	value: unknown,
): RecipeConfiguration {
	const parsed = normaliseRecipeConfiguration(value);
	if (!recipe || recipe.configurationFields.length === 0) {
		return parsed;
	}

	const configuration: RecipeConfiguration = {};
	for (const field of recipe.configurationFields) {
		const normalisedValue = normaliseConfigurationValue(field, parsed[field.key]);
		if (normalisedValue !== undefined && normalisedValue !== null && normalisedValue !== "") {
			configuration[field.key] = normalisedValue;
		}
	}

	return configuration;
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

function createConversationStarter(
	recipe: AssistantRecipe,
	connections: AssistantRecipeConnection[],
	input?: string,
	enabledTools = recipe.enabledTools,
	configuration?: RecipeConfiguration,
	prompt = recipe.setupPrompt,
) {
	const connectionSection =
		connections.length > 0
			? `\nConnector status:\n${connections
					.map((connection) => `- ${connection.name}: ${connection.status.replace("_", " ")}`)
					.join("\n")}\n`
			: "";
	const toolLine = enabledTools.length > 0 ? enabledTools.join(", ") : "no extra tools";
	const inputLine = input?.trim() ? `\nTrigger input:\n${input.trim()}\n` : "";
	const configurationContext = buildRecipeConfigurationContext(recipe, configuration);
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

function parseStoredRecipeInstallationData(
	record: RecipeInstallationRecord,
): StoredRecipeInstallationData | null {
	const parsed = safeParseJson(record.data) as StoredRecipeInstallationData | null;
	if (
		(record.app_id !== undefined && record.app_id !== RECIPE_INSTALLATION_APP_ID) ||
		(record.item_type !== undefined && record.item_type !== RECIPE_INSTALLATION_ITEM_TYPE) ||
		!parsed?.recipeId ||
		parsed.recipeId !== record.item_id
	) {
		return null;
	}

	return parsed;
}

export function parseRecipeInstallationRecord(
	record: RecipeInstallationRecord,
): RecipeInstallation | null {
	const parsed = parseStoredRecipeInstallationData(record);
	if (!parsed) {
		return null;
	}

	return {
		id: record.id,
		recipeId: parsed.recipeId,
		userId: record.user_id,
		status: parsed.status ?? "active",
		triggers: Array.isArray(parsed.triggers) ? parsed.triggers : [],
		configuration: normaliseRecipeConfigurationForRecipe(
			getRecipeById(parsed.recipeId),
			parsed.configuration,
		),
		createdAt: record.created_at,
		updatedAt: record.updated_at,
	};
}

async function getRecipeInstallationRecord(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
}): Promise<{ record: RecipeInstallationRecord; data: StoredRecipeInstallationData } | null> {
	const record = await params.context.repositories.appData.getAppDataByUserAndId(
		params.userId,
		params.installationId,
		RECIPE_INSTALLATION_ITEM_TYPE,
	);
	if (!record || record.app_id !== RECIPE_INSTALLATION_APP_ID) {
		return null;
	}

	const data = parseStoredRecipeInstallationData(record);
	if (!data) {
		return null;
	}

	return { record, data };
}

async function upsertRecipeInstallation(params: {
	context: ServiceContext;
	userId: number;
	recipe: AssistantRecipe;
	triggers?: RecipeInstallationTrigger[];
	configuration?: RecipeConfiguration;
}): Promise<RecipeInstallation> {
	params.context.ensureDatabase();
	const existing = await params.context.repositories.appData.getAppDataByUserAppAndItem(
		params.userId,
		RECIPE_INSTALLATION_APP_ID,
		params.recipe.id,
		RECIPE_INSTALLATION_ITEM_TYPE,
	);
	const existingData = existing[0] ? parseStoredRecipeInstallationData(existing[0]) : null;
	const now = new Date().toISOString();
	const triggers =
		params.triggers && params.triggers.length > 0
			? params.triggers
			: Array.isArray(existingData?.triggers) && existingData.triggers.length > 0
				? existingData.triggers
				: [
						{
							type: "manual" as const,
							enabled: true,
						},
					];
	validateRecipeInstallationTriggers(params.recipe, triggers);
	const configuration = normaliseRecipeConfigurationForRecipe(
		params.recipe,
		params.configuration ?? existingData?.configuration,
	);
	validateScheduledRecipeConfiguration({
		recipe: params.recipe,
		triggers,
		configuration,
	});
	const data: StoredRecipeInstallationData = {
		recipeId: params.recipe.id,
		status: "active",
		triggers,
		configuration,
		scheduleState: buildRecipeScheduleState({
			triggers,
			existingState: existingData?.scheduleState,
			activatedAt: now,
		}),
	};

	if (existing[0]) {
		await params.context.repositories.appData.updateAppData(existing[0].id, data);
		const updated = await params.context.repositories.appData.getAppDataById(existing[0].id);
		if (updated) {
			const parsed = parseRecipeInstallationRecord(updated);
			if (parsed) {
				return parsed;
			}
		}
	}

	const created = await params.context.repositories.appData.createAppDataWithItem(
		params.userId,
		RECIPE_INSTALLATION_APP_ID,
		params.recipe.id,
		RECIPE_INSTALLATION_ITEM_TYPE,
		data,
	);
	const parsed = parseRecipeInstallationRecord(created);
	if (!parsed) {
		throw new AssistantError("Recipe installation could not be created", ErrorType.INTERNAL_ERROR);
	}

	return parsed;
}

async function getRecipeInstallation(params: {
	context: ServiceContext;
	userId: number;
	recipeId: string;
}): Promise<RecipeInstallation | null> {
	const records = await params.context.repositories.appData.getAppDataByUserAppAndItem(
		params.userId,
		RECIPE_INSTALLATION_APP_ID,
		params.recipeId,
		RECIPE_INSTALLATION_ITEM_TYPE,
	);

	return records[0] ? parseRecipeInstallationRecord(records[0]) : null;
}

export async function listRecipeInstallations(params: {
	context: ServiceContext;
	userId: number;
}): Promise<{ installations: RecipeInstallation[] }> {
	params.context.ensureDatabase();
	const records = await params.context.repositories.appData.getAppDataByUserAndApp(
		params.userId,
		RECIPE_INSTALLATION_APP_ID,
	);

	return {
		installations: records
			.map((record) => parseRecipeInstallationRecord(record))
			.filter((installation): installation is RecipeInstallation => Boolean(installation)),
	};
}

export async function resolveInstalledAssistantRecipe(params: {
	context: ServiceContext;
	userId: number;
	query: string;
	requestUrl?: string;
}) {
	const [recipeList, installationList] = await Promise.all([
		listAssistantRecipes({
			context: params.context,
			userId: params.userId,
			requestUrl: params.requestUrl,
		}),
		listRecipeInstallations({
			context: params.context,
			userId: params.userId,
		}),
	]);

	return matchInstalledRecipe({
		query: params.query,
		recipes: recipeList.recipes,
		installations: installationList.installations,
	});
}

export async function updateRecipeInstallation(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
	update: RecipeInstallationUpdateRequest;
	requestUrl?: string;
}): Promise<RecipeInstallation | null> {
	params.context.ensureDatabase();

	const existing = await getRecipeInstallationRecord({
		context: params.context,
		userId: params.userId,
		installationId: params.installationId,
	});
	if (!existing) {
		return null;
	}

	const recipe = await getAssistantRecipe(existing.data.recipeId, {
		context: params.context,
		userId: params.userId,
		requestUrl: params.requestUrl,
	});
	const triggers = params.update.triggers ?? existing.data.triggers;
	const configuration = normaliseRecipeConfigurationForRecipe(
		recipe,
		params.update.configuration ?? existing.data.configuration,
	);
	const data: StoredRecipeInstallationData = {
		recipeId: existing.data.recipeId,
		status: params.update.status ?? existing.data.status,
		triggers,
		configuration,
		scheduleState: buildRecipeScheduleState({
			triggers,
			existingState: existing.data.scheduleState,
			activatedAt: new Date().toISOString(),
		}),
	};
	if (recipe) {
		if (params.update.configuration !== undefined || params.update.triggers !== undefined) {
			assertNoUnavailableConnections(
				recipe,
				buildRecipeConnections(recipe),
				params.update.triggers !== undefined ? "scheduled" : "configured",
			);
		}
		validateRecipeInstallationTriggers(recipe, data.triggers);
		validateScheduledRecipeConfiguration({
			recipe,
			triggers: data.triggers,
			configuration: data.configuration,
		});
	}

	await params.context.repositories.appData.updateAppData(existing.record.id, data);
	const updated = await params.context.repositories.appData.getAppDataById(existing.record.id);

	return updated ? parseRecipeInstallationRecord(updated) : null;
}

export async function deleteRecipeInstallation(params: {
	context: ServiceContext;
	userId: number;
	installationId: string;
}): Promise<boolean> {
	params.context.ensureDatabase();

	const existing = await getRecipeInstallationRecord({
		context: params.context,
		userId: params.userId,
		installationId: params.installationId,
	});
	if (!existing) {
		return false;
	}

	await params.context.repositories.appData.deleteAppData(existing.record.id);
	return true;
}

export async function listAssistantRecipes(options: RecipeListOptions = {}) {
	const connectionContext = await getRecipeConnectionContext(options);

	return {
		recipes: assistantRecipes.map((recipe) => enrichRecipe(recipe, connectionContext)),
		categories: recipeCategories,
		filters: recipeFilters,
	};
}

export async function getAssistantRecipe(id: string, options: RecipeListOptions = {}) {
	const recipe = getRecipeById(id);
	if (!recipe) {
		return null;
	}

	const connectionContext = await getRecipeConnectionContext(options);
	return enrichRecipe(recipe, connectionContext);
}

export async function installAssistantRecipe(id: string, options: RecipeInstallOptions) {
	const recipe = await getAssistantRecipe(id, options);
	if (!recipe) {
		return null;
	}

	if (!options.context || !options.userId) {
		throw new AssistantError(
			"Recipe install requires an authenticated user",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const connections = buildRecipeConnections(recipe);
	assertNoUnavailableConnections(recipe, connections, "set up");
	const readyToRun = getBlockingConnections(connections).length === 0;
	const allowedConnectorProviders = buildAllowedConnectorProviders(recipe);
	const allowedConnectorOperations = buildAllowedConnectorOperations(recipe);
	const setupEnabledTools = Array.from(
		new Set([...recipe.enabledTools, RECIPE_LOOKUP_TOOL, RECIPE_SETUP_TOOL]),
	);
	const installation = await upsertRecipeInstallation({
		context: options.context,
		userId: options.userId,
		recipe,
		triggers: options.triggers,
		configuration: options.configuration,
	});
	const conversationStarter = createConversationStarter(
		recipe,
		connections,
		undefined,
		setupEnabledTools,
		installation.configuration,
	);

	return {
		recipe,
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, setupEnabledTools),
		checklist: buildRecipeChecklist(recipe, connections, setupEnabledTools),
		connections,
		readyToRun,
		enabledTools: setupEnabledTools,
		allowedConnectorProviders,
		allowedConnectorOperations,
		installation,
	};
}

export async function invokeAssistantRecipe(
	id: string,
	options: RecipeListOptions & {
		channel: "web" | "ios" | "sms" | "scheduled" | "tool";
		input?: string;
		configuration?: RecipeConfiguration;
		queue?: boolean;
		requireInstalled?: boolean;
	},
) {
	if (!options.context || !options.userId) {
		throw new AssistantError(
			"Recipe invocation requires an authenticated user",
			ErrorType.AUTHENTICATION_ERROR,
		);
	}

	const recipe = await getAssistantRecipe(id, options);
	if (!recipe) {
		return null;
	}

	const connections = buildRecipeConnections(recipe);
	const blockingConnections = getBlockingConnections(connections);
	const allowedConnectorProviders = buildAllowedConnectorProviders(recipe);
	const allowedConnectorOperations = buildAllowedConnectorOperations(recipe);
	const existingInstallation = await getRecipeInstallation({
		context: options.context,
		userId: options.userId,
		recipeId: recipe.id,
	});
	const installation =
		existingInstallation ??
		(options.requireInstalled
			? null
			: await upsertRecipeInstallation({
					context: options.context,
					userId: options.userId,
					recipe,
				}));
	const invocationConfiguration = installation
		? options.configuration
			? normaliseRecipeConfigurationForRecipe(recipe, options.configuration)
			: installation.configuration
		: {};
	const invocationEnabledTools = Array.from(new Set(recipe.enabledTools));
	const invocationPrompt = installation
		? buildRecipeInvocationPrompt({
				recipe,
				installation,
				input: options.input,
			})
		: recipe.setupPrompt;
	const conversationStarter = createConversationStarter(
		recipe,
		connections,
		undefined,
		invocationEnabledTools,
		invocationConfiguration,
		invocationPrompt,
	);

	if (!installation) {
		return {
			recipeId: recipe.id,
			recipeTitle: recipe.title,
			status: "not_installed" as const,
			channel: options.channel,
			conversationStarter,
			messageUrl: createRecipeMessageUrl(conversationStarter, invocationEnabledTools),
			missingConnections: [],
			enabledTools: invocationEnabledTools,
			allowedConnectorProviders,
			allowedConnectorOperations,
			configuration: invocationConfiguration,
		};
	}

	if (blockingConnections.length > 0) {
		return {
			recipeId: recipe.id,
			recipeTitle: recipe.title,
			installationId: installation.id,
			status: "blocked" as const,
			channel: options.channel,
			conversationStarter,
			messageUrl: createRecipeMessageUrl(conversationStarter, invocationEnabledTools),
			missingConnections: blockingConnections,
			enabledTools: invocationEnabledTools,
			allowedConnectorProviders,
			allowedConnectorOperations,
			configuration: invocationConfiguration,
		};
	}

	let taskId: string | undefined;
	if (options.queue) {
		const taskService = new TaskService(options.context.env, options.context.repositories.tasks);
		taskId = await taskService.enqueueTask({
			task_type: "recipe_execution",
			user_id: options.userId,
			task_data: {
				recipeId: recipe.id,
				installationId: installation.id,
				input: options.input,
				channel: options.channel,
				configuration: invocationConfiguration,
			},
			priority: 5,
		});
	}

	return {
		recipeId: recipe.id,
		recipeTitle: recipe.title,
		installationId: installation.id,
		status: options.queue ? ("queued" as const) : ("ready" as const),
		channel: options.channel,
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, invocationEnabledTools),
		missingConnections: [],
		enabledTools: invocationEnabledTools,
		allowedConnectorProviders,
		allowedConnectorOperations,
		configuration: invocationConfiguration,
		taskId,
	};
}

export function createRecipeMessageUrl(setupPrompt: string, enabledTools: string[] = []) {
	const params = new URLSearchParams({ query: setupPrompt });
	if (enabledTools.length > 0) {
		params.set("enabled_tools", enabledTools.join(","));
	}

	return `/?${params.toString()}`;
}
