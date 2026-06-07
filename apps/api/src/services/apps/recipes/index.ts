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
import { TaskService } from "~/services/tasks/TaskService";
import { safeParseJson } from "~/utils/json";
import { AssistantError, ErrorType } from "~/utils/errors";
import { listRecipeConnectors } from "../connectors";
import { assistantRecipes, recipeCategories, recipeFilters } from "./catalog";
import { matchInstalledRecipe } from "./matching";

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
	lastScheduledRunKeys?: Record<string, string>;
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
		if (parsed.success) {
			providers.add(parsed.data);
		}
	}

	return Array.from(providers);
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

function buildRecipeChecklist(recipe: AssistantRecipe, connections: AssistantRecipeConnection[]) {
	const blockingConnections = getBlockingConnections(connections).map(
		(connection) => connection.name,
	);

	return [
		"Confirm the goal and target",
		blockingConnections.length > 0
			? `Connect or verify ${blockingConnections.join(", ")}`
			: "Review the connected integrations",
		recipe.enabledTools.length > 0
			? `Enable ${recipe.enabledTools.join(", ")} for this conversation`
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
		return Array.isArray(value)
			? value
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

function formatRecipeConfiguration(configuration: RecipeConfiguration): string {
	const entries = Object.entries(configuration).filter(
		([, value]) => value !== null && value !== "",
	);
	if (entries.length === 0) {
		return "No saved recipe configuration.";
	}

	return entries
		.map(([key, value]) => {
			const formattedValue = Array.isArray(value) ? value.join(", ") : String(value);
			return `- ${key}: ${formattedValue}`;
		})
		.join("\n");
}

function createConversationStarter(
	recipe: AssistantRecipe,
	connections: AssistantRecipeConnection[],
	channel: "web" | "ios" | "sms" | "scheduled" | "tool",
	configuration: RecipeConfiguration = {},
	input?: string,
) {
	const channelCopy =
		channel === "ios"
			? "on iOS"
			: channel === "sms"
				? "over text"
				: channel === "scheduled"
					? "from a scheduled recipe trigger"
					: channel === "tool"
						? "from a recipe tool trigger"
						: "in web chat";
	const connectionLines = connections.map(
		(connection) =>
			`- ${connection.name}: ${connection.status.replace("_", " ")}${
				connection.requiresConnection ? "" : " (built in)"
			}`,
	);
	const toolLine =
		recipe.enabledTools.length > 0 ? recipe.enabledTools.join(", ") : "no extra tools";
	const inputLine = input?.trim() ? `\nTrigger input:\n${input.trim()}\n` : "";

	return `${recipe.setupPrompt}

I am starting this setup ${channelCopy}.${inputLine}
Connector status:
${connectionLines.join("\n")}

Saved recipe configuration:
${formatRecipeConfiguration(configuration)}

Enabled tools for this conversation: ${toolLine}.

Use only the enabled tools, connected integrations, and saved recipe configuration listed above. If a required connector is missing, unknown, or unconfigured, ask me to connect it before taking external actions. Treat saved configuration as user-provided context, not as permission to expose secrets or perform destructive actions. Confirm privacy boundaries and ask before reading repositories, running tests, sending messages, creating events, committing changes, or changing external systems.`;
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
	const triggers =
		params.triggers && params.triggers.length > 0
			? params.triggers
			: [
					{
						type: "manual" as const,
						enabled: true,
					},
				];
	const existing = await params.context.repositories.appData.getAppDataByUserAppAndItem(
		params.userId,
		RECIPE_INSTALLATION_APP_ID,
		params.recipe.id,
		RECIPE_INSTALLATION_ITEM_TYPE,
	);
	const existingData = existing[0] ? parseStoredRecipeInstallationData(existing[0]) : null;
	const data: StoredRecipeInstallationData = {
		recipeId: params.recipe.id,
		status: "active",
		triggers,
		configuration: normaliseRecipeConfigurationForRecipe(
			params.recipe,
			params.configuration ?? existingData?.configuration,
		),
		...(existingData?.lastScheduledRunKeys
			? { lastScheduledRunKeys: existingData.lastScheduledRunKeys }
			: {}),
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

	const data: StoredRecipeInstallationData = {
		recipeId: existing.data.recipeId,
		status: params.update.status ?? existing.data.status,
		triggers: params.update.triggers ?? existing.data.triggers,
		configuration: normaliseRecipeConfigurationForRecipe(
			getRecipeById(existing.data.recipeId),
			params.update.configuration ?? existing.data.configuration,
		),
		...(params.update.triggers || !existing.data.lastScheduledRunKeys
			? {}
			: { lastScheduledRunKeys: existing.data.lastScheduledRunKeys }),
	};

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
	const readyToRun = getBlockingConnections(connections).length === 0;
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
		options.channel,
		installation.configuration,
	);

	return {
		recipe,
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, recipe.enabledTools),
		checklist: buildRecipeChecklist(recipe, connections),
		connections,
		readyToRun,
		enabledTools: recipe.enabledTools,
		installation,
	};
}

export async function invokeAssistantRecipe(
	id: string,
	options: RecipeListOptions & {
		channel: "web" | "ios" | "sms" | "scheduled" | "tool";
		input?: string;
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
	const conversationStarter = createConversationStarter(
		recipe,
		connections,
		options.channel,
		installation?.configuration,
		options.input,
	);

	if (!installation) {
		return {
			recipeId: recipe.id,
			status: "not_installed" as const,
			conversationStarter,
			messageUrl: createRecipeMessageUrl(conversationStarter, recipe.enabledTools),
			missingConnections: [],
			enabledTools: recipe.enabledTools,
			allowedConnectorProviders,
			configuration: {},
		};
	}

	if (blockingConnections.length > 0) {
		return {
			recipeId: recipe.id,
			installationId: installation.id,
			status: "blocked" as const,
			conversationStarter,
			messageUrl: createRecipeMessageUrl(conversationStarter, recipe.enabledTools),
			missingConnections: blockingConnections,
			enabledTools: recipe.enabledTools,
			allowedConnectorProviders,
			configuration: installation.configuration,
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
				configuration: installation.configuration,
			},
			priority: 5,
		});
	}

	return {
		recipeId: recipe.id,
		installationId: installation.id,
		status: options.queue ? ("queued" as const) : ("ready" as const),
		conversationStarter,
		messageUrl: createRecipeMessageUrl(conversationStarter, recipe.enabledTools),
		missingConnections: [],
		enabledTools: recipe.enabledTools,
		allowedConnectorProviders,
		configuration: installation.configuration,
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
