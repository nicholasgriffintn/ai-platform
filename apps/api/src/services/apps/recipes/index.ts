import type {
	AssistantRecipe,
	AssistantRecipeConnection,
	RecipeConfigurationField,
	RecipeConfiguration,
	RecipeConnectionStatus,
	RecipeInstallation,
	RecipeInstallationTrigger,
	RecipeInstallationUpdateRequest,
	RecipeConnectorManifest,
} from "@ngriffin_uk/polychat-schemas";
import { recipeConfigurationSchema } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { TemplateRecord } from "~/repositories/TemplateRepository";
import { TaskService } from "~/services/tasks/TaskService";
import { requireProjectAccess } from "~/services/workspaces/access";
import { isSupportedCronExpression } from "~/utils/cron";
import { safeParseJson } from "~/utils/json";
import { AssistantError, ErrorType } from "~/utils/errors";
import { listRecipeConnectors } from "../connectors";
import { assistantRecipes, recipeCategories, recipeFilters } from "./catalog";
import { createRecipeCapabilityDescriptor } from "./capabilities";
import { matchInstalledRecipe } from "./matching";
import {
	buildRecipeConnections,
	buildRecipeInvocationRuntime,
	buildRecipeSetupRuntime,
	getBlockingConnections,
	isRequiredRecipeConfigurationValueMissing,
} from "./runtime";
import { buildRecipeScheduleState, type RecipeScheduleState } from "./scheduleState";
import {
	deleteRecipeComposioTriggers,
	syncRecipeComposioTriggerStatus,
} from "./composio-trigger-lifecycle";

export const RECIPE_INSTALLATION_APP_ID = "assistant_recipe_installation";
export const RECIPE_INSTALLATION_ITEM_TYPE = "recipe_installation";

interface RecipeListOptions {
	context?: ServiceContext;
	userId?: number;
	requestUrl?: string;
	connectors?: readonly RecipeConnectorManifest[];
}

interface RecipeInstallOptions extends RecipeListOptions {
	channel: "web" | "ios" | "sms";
	projectId?: string;
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

type RecipeInstallationRecord = TemplateRecord;

export function getRecipeById(id: string) {
	return assistantRecipes.find((recipe) => recipe.id === id);
}

async function requireEnabledProjectRecipe(
	context: ServiceContext,
	projectId: string,
	recipeId: string,
): Promise<void> {
	await requireProjectAccess(context, projectId);
	const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
	if (
		!capabilities.some(
			(capability) => capability.kind === "recipe" && capability.capability_id === recipeId,
		)
	) {
		throw new AssistantError(
			"This recipe is not enabled for the project",
			ErrorType.FORBIDDEN,
			403,
		);
	}
}

async function getRecipeConnectionContext({
	context,
	userId,
	requestUrl,
	connectors: providedConnectors,
}: RecipeListOptions): Promise<RecipeConnectionContext> {
	const statusByProviderId = new Map<string, RecipeConnectionStatus>();
	const setupUrlByProviderId = new Map<string, string | undefined>();

	if (!context || !userId) {
		return { statusByProviderId, setupUrlByProviderId };
	}

	const connectors =
		providedConnectors ?? (await listRecipeConnectors({ context, userId, requestUrl })).connectors;
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
		capability: createRecipeCapabilityDescriptor(recipe),
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

function parseStoredRecipeInstallationData(
	record: RecipeInstallationRecord,
): StoredRecipeInstallationData | null {
	const parsed = safeParseJson(record.configuration) as StoredRecipeInstallationData | null;
	if (record.kind !== "recipe" || !parsed?.recipeId || parsed.recipeId !== record.capability_id) {
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
		userId: record.created_by_user_id,
		projectId: record.project_id,
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
	const record = await params.context.repositories.templates.getTemplateById(params.installationId);
	if (!record || record.created_by_user_id !== params.userId || record.kind !== "recipe") {
		return null;
	}
	if (record.project_id) {
		await requireProjectAccess(params.context, record.project_id);
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
	projectId?: string;
	triggers?: RecipeInstallationTrigger[];
	configuration?: RecipeConfiguration;
}): Promise<RecipeInstallation> {
	params.context.ensureDatabase();
	const existing = params.projectId
		? await params.context.repositories.templates.getProjectTemplate(
				params.userId,
				params.projectId,
				"recipe",
				params.recipe.id,
			)
		: await params.context.repositories.templates.getPersonalTemplate(
				params.userId,
				"recipe",
				params.recipe.id,
			);
	const existingData = existing ? parseStoredRecipeInstallationData(existing) : null;
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

	if (existing) {
		const updated = await params.context.repositories.templates.updateTemplate(existing.id, {
			name: params.recipe.title,
			configuration: data,
			status: data.status,
		});
		if (updated) {
			const parsed = parseRecipeInstallationRecord(updated);
			if (parsed) {
				return parsed;
			}
		}
	}

	const created = await params.context.repositories.templates.createTemplate({
		createdByUserId: params.userId,
		projectId: params.projectId,
		kind: "recipe",
		capabilityId: params.recipe.id,
		name: params.recipe.title,
		description: params.recipe.description,
		configuration: data,
		status: data.status,
	});
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
	projectId?: string;
}): Promise<RecipeInstallation | null> {
	const record = params.projectId
		? await params.context.repositories.templates.getProjectTemplate(
				params.userId,
				params.projectId,
				"recipe",
				params.recipeId,
			)
		: await params.context.repositories.templates.getPersonalTemplate(
				params.userId,
				"recipe",
				params.recipeId,
			);

	return record ? parseRecipeInstallationRecord(record) : null;
}

export async function listRecipeInstallations(params: {
	context: ServiceContext;
	userId: number;
	projectId?: string;
}): Promise<{ installations: RecipeInstallation[] }> {
	params.context.ensureDatabase();
	const records = params.projectId
		? (await requireProjectAccess(params.context, params.projectId),
			await params.context.repositories.templates.listProjectTemplates(params.projectId, "recipe"))
		: await params.context.repositories.templates.listPersonalTemplates(params.userId, "recipe");

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

	const updated = await params.context.repositories.templates.updateTemplate(existing.record.id, {
		configuration: data,
		status: data.status,
	});
	if (params.update.status && params.update.status !== existing.data.status) {
		await syncRecipeComposioTriggerStatus({
			context: params.context,
			userId: params.userId,
			installationId: existing.record.id,
			enabled: data.status === "active",
		});
	}

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
	await deleteRecipeComposioTriggers({
		context: params.context,
		userId: params.userId,
		installationId: existing.record.id,
	});

	await params.context.repositories.templates.deleteTemplate(existing.record.id);
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
	if (options.projectId) {
		await requireEnabledProjectRecipe(options.context, options.projectId, recipe.id);
	}

	const connections = buildRecipeConnections(recipe);
	assertNoUnavailableConnections(recipe, connections, "set up");
	const readyToRun = getBlockingConnections(connections).length === 0;
	const installation = await upsertRecipeInstallation({
		context: options.context,
		userId: options.userId,
		recipe,
		projectId: options.projectId,
		triggers: options.triggers,
		configuration: options.configuration,
	});
	const runtime = buildRecipeSetupRuntime({
		recipe,
		connections,
		configuration: installation.configuration,
	});

	return {
		recipe,
		conversationStarter: runtime.conversationStarter,
		messageUrl: runtime.messageUrl,
		checklist: runtime.checklist ?? [],
		connections,
		readyToRun,
		enabledTools: runtime.enabledTools,
		allowedConnectorProviders: runtime.allowedConnectorProviders,
		allowedConnectorOperations: runtime.allowedConnectorOperations,
		installation,
	};
}

export async function invokeAssistantRecipe(
	id: string,
	options: RecipeListOptions & {
		channel: "web" | "ios" | "sms" | "scheduled" | "event" | "tool";
		input?: string;
		configuration?: RecipeConfiguration;
		queue?: boolean;
		requireInstalled?: boolean;
		projectId?: string;
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
	if (options.projectId) {
		await requireEnabledProjectRecipe(options.context, options.projectId, recipe.id);
	}

	const connections = buildRecipeConnections(recipe);
	const blockingConnections = getBlockingConnections(connections);
	const existingInstallation = await getRecipeInstallation({
		context: options.context,
		userId: options.userId,
		recipeId: recipe.id,
		projectId: options.projectId,
	});
	const installation =
		existingInstallation ??
		(options.requireInstalled
			? null
			: await upsertRecipeInstallation({
					context: options.context,
					userId: options.userId,
					recipe,
					projectId: options.projectId,
				}));
	const invocationConfiguration = installation
		? options.configuration
			? normaliseRecipeConfigurationForRecipe(recipe, options.configuration)
			: installation.configuration
		: {};
	const runtime = buildRecipeInvocationRuntime({
		recipe,
		connections,
		installation,
		input: options.input,
		configuration: invocationConfiguration,
	});

	if (!installation) {
		return {
			recipeId: recipe.id,
			recipeTitle: recipe.title,
			projectId: options.projectId ?? null,
			status: "not_installed" as const,
			channel: options.channel,
			conversationStarter: runtime.conversationStarter,
			messageUrl: runtime.messageUrl,
			missingConnections: [],
			enabledTools: runtime.enabledTools,
			allowedConnectorProviders: runtime.allowedConnectorProviders,
			allowedConnectorOperations: runtime.allowedConnectorOperations,
			configuration: invocationConfiguration,
		};
	}

	if (blockingConnections.length > 0) {
		return {
			recipeId: recipe.id,
			recipeTitle: recipe.title,
			installationId: installation.id,
			projectId: installation.projectId,
			status: "blocked" as const,
			channel: options.channel,
			conversationStarter: runtime.conversationStarter,
			messageUrl: runtime.messageUrl,
			missingConnections: blockingConnections,
			enabledTools: runtime.enabledTools,
			allowedConnectorProviders: runtime.allowedConnectorProviders,
			allowedConnectorOperations: runtime.allowedConnectorOperations,
			configuration: invocationConfiguration,
		};
	}

	let taskId: string | undefined;
	if (options.queue) {
		const taskService = new TaskService(options.context.env, options.context.repositories.tasks);
		taskId = await taskService.enqueueTask({
			task_type: "recipe_execution",
			user_id: options.userId,
			project_id: installation.projectId ?? undefined,
			task_data: {
				recipeId: recipe.id,
				installationId: installation.id,
				projectId: installation.projectId,
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
		projectId: installation.projectId,
		status: options.queue ? ("queued" as const) : ("ready" as const),
		channel: options.channel,
		conversationStarter: runtime.conversationStarter,
		messageUrl: runtime.messageUrl,
		missingConnections: [],
		enabledTools: runtime.enabledTools,
		allowedConnectorProviders: runtime.allowedConnectorProviders,
		allowedConnectorOperations: runtime.allowedConnectorOperations,
		configuration: invocationConfiguration,
		taskId,
	};
}
