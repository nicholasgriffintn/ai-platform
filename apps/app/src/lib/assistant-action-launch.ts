import type { AssistantRecipeInstallResponse, RecipeInvocationResponse } from "@assistant/schemas";
import { recipeConfigurationSchema, recipeConnectorProviderSchema } from "@assistant/schemas";

import { isRecord } from "./objects";
import type { ChatRequestOptions } from "~/types";

const ACTION_CONTEXT_PARAM = "assistant_action_context";
const LEGACY_RECIPE_CONTEXT_PARAM = "recipe_context";
const AUTO_SUBMIT_PARAM = "auto_submit";
const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

type RecipeChatSetupResponse = AssistantRecipeInstallResponse | RecipeInvocationResponse;
type RecipeRequestOptions = NonNullable<ChatRequestOptions["recipe"]>;
type RecipeChannel = NonNullable<RecipeRequestOptions["channel"]>;

interface LegacyRecipeContextPayload {
	recipe: RecipeRequestOptions;
}

interface AssistantRecipeActionContext {
	kind: "recipe";
	recipe: RecipeRequestOptions;
}

interface AssistantActionContextPayload {
	action: AssistantRecipeActionContext;
}

export interface AssistantActionLaunchState {
	query: string | null;
	enabledTools: string[];
	hasEnabledTools: boolean;
	actionContext: string | null;
	recipeContext: string | null;
	autoSubmit: boolean;
}

export interface AssistantActionChatLaunchPayload {
	input: string;
	enabledTools: string[];
	requestOptions?: ChatRequestOptions;
}

interface AppAssistantActionLaunchSource {
	appId?: string;
	appKind?: "dynamic" | "frontend";
	href?: string;
}

interface ConnectorAssistantActionLaunchSource {
	authType?: "api_key" | "github_app" | "oauth2";
	authorizationUrl?: string;
	provider?: string;
}

export interface AssistantActionNavigationLaunchPayload {
	externalUrl?: string;
	navigationPath: string;
}

export interface AssistantActionExternalLaunchPayload {
	externalUrl: string;
	navigationPath?: string;
}

interface AssistantActionChatLaunch {
	messageUrl: string;
	enabledTools?: string | string[];
	actionContext?: AssistantActionContextPayload;
}

function normaliseToolIds(value: string | string[] | undefined): string[] {
	const rawTools = Array.isArray(value) ? value : (value ?? "").split(",");

	return Array.from(
		new Set(
			rawTools
				.map((toolId) => toolId.trim())
				.filter((toolId) => toolId && TOOL_ID_PATTERN.test(toolId)),
		),
	);
}

function createRecipeRequestOptions(response: RecipeChatSetupResponse): RecipeRequestOptions {
	if ("recipe" in response) {
		return {
			id: response.recipe.id,
			installationId: response.installation?.id,
			channel: "web",
			allowedConnectorProviders: response.allowedConnectorProviders ?? [],
			allowedConnectorOperations: response.allowedConnectorOperations ?? {},
			configuration: response.installation?.configuration ?? {},
		};
	}

	return {
		id: response.recipeId,
		installationId: response.installationId,
		channel: response.channel,
		allowedConnectorProviders: response.allowedConnectorProviders ?? [],
		allowedConnectorOperations: response.allowedConnectorOperations ?? {},
		configuration: response.configuration,
	};
}

function createRecipeActionContext(
	response: RecipeChatSetupResponse,
): AssistantActionContextPayload {
	return {
		action: {
			kind: "recipe",
			recipe: createRecipeRequestOptions(response),
		},
	};
}

function readRecipeChannel(value: unknown): RecipeChannel {
	switch (value) {
		case "ios":
		case "sms":
		case "scheduled":
		case "tool":
		case "web":
			return value;
		default:
			return "web";
	}
}

function readConnectorProviders(value: unknown): RecipeRequestOptions["allowedConnectorProviders"] {
	return (Array.isArray(value) ? value : []).flatMap((provider) => {
		const parsed = recipeConnectorProviderSchema.safeParse(provider);
		return parsed.success ? [parsed.data] : [];
	});
}

function readConnectorOperations(
	value: unknown,
): RecipeRequestOptions["allowedConnectorOperations"] {
	return Object.fromEntries(
		Object.entries(isRecord(value) ? value : {})
			.map(([provider, operations]) => [
				provider,
				Array.isArray(operations)
					? operations.filter((operation): operation is string => typeof operation === "string")
					: [],
			])
			.filter(([, operations]) => operations.length > 0),
	);
}

function readRecipeRequestOptions(value: unknown): RecipeRequestOptions | undefined {
	if (!isRecord(value) || typeof value.id !== "string") {
		return undefined;
	}

	const configuration = recipeConfigurationSchema.safeParse(value.configuration);

	return {
		id: value.id,
		installationId: typeof value.installationId === "string" ? value.installationId : undefined,
		channel: readRecipeChannel(value.channel),
		allowedConnectorProviders: readConnectorProviders(value.allowedConnectorProviders),
		allowedConnectorOperations: readConnectorOperations(value.allowedConnectorOperations),
		configuration: configuration.success ? configuration.data : {},
	};
}

function readLegacyRecipeContextPayload(value: unknown): LegacyRecipeContextPayload | undefined {
	if (!isRecord(value) || !isRecord(value.recipe)) {
		return undefined;
	}

	const recipe = readRecipeRequestOptions(value.recipe);
	return recipe ? { recipe } : undefined;
}

function readAssistantActionContextPayload(
	value: unknown,
): AssistantActionContextPayload | undefined {
	if (!isRecord(value) || !isRecord(value.action) || value.action.kind !== "recipe") {
		return undefined;
	}

	const recipe = readRecipeRequestOptions(value.action.recipe);
	return recipe
		? {
				action: {
					kind: "recipe",
					recipe,
				},
			}
		: undefined;
}

function parseJson(value: string | null): unknown {
	if (!value) {
		return undefined;
	}

	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

export function parseAssistantActionLaunchState(search: string): AssistantActionLaunchState {
	const params = new URLSearchParams(search);

	return {
		query: params.get("query"),
		enabledTools: normaliseToolIds(params.get("enabled_tools") ?? undefined),
		hasEnabledTools: params.has("enabled_tools"),
		actionContext: params.get(ACTION_CONTEXT_PARAM),
		recipeContext: params.get(LEGACY_RECIPE_CONTEXT_PARAM),
		autoSubmit: params.get(AUTO_SUBMIT_PARAM) === "1",
	};
}

export function loadAssistantActionRequestOptions(
	state: Pick<AssistantActionLaunchState, "actionContext" | "recipeContext">,
): ChatRequestOptions | undefined {
	const actionPayload = readAssistantActionContextPayload(parseJson(state.actionContext));
	if (actionPayload) {
		return { recipe: actionPayload.action.recipe };
	}

	const legacyRecipePayload = readLegacyRecipeContextPayload(parseJson(state.recipeContext));
	return legacyRecipePayload ? { recipe: legacyRecipePayload.recipe } : undefined;
}

export function createAssistantActionChatUrl(launch: AssistantActionChatLaunch): string {
	const [path, search = ""] = launch.messageUrl.split("?");
	const params = new URLSearchParams(search);
	const enabledTools = normaliseToolIds(launch.enabledTools);

	params.set("enabled_tools", enabledTools.join(","));
	params.set(AUTO_SUBMIT_PARAM, "1");
	if (launch.actionContext) {
		params.set(ACTION_CONTEXT_PARAM, JSON.stringify(launch.actionContext));
	}

	const query = params.toString();
	return query ? `${path}?${query}` : path;
}

export function createRecipeAssistantActionChatUrl(response: RecipeChatSetupResponse): string {
	return createAssistantActionChatUrl({
		messageUrl: response.messageUrl,
		enabledTools: response.enabledTools,
		actionContext: createRecipeActionContext(response),
	});
}

export function createRecipeAssistantActionLaunch(
	response: RecipeChatSetupResponse,
): AssistantActionChatLaunchPayload {
	const requestOptions = loadAssistantActionRequestOptions({
		actionContext: JSON.stringify(createRecipeActionContext(response)),
		recipeContext: null,
	});

	return {
		input: response.conversationStarter,
		enabledTools: normaliseToolIds(response.enabledTools),
		requestOptions,
	};
}

export function createAssistantActionConversationUrl(
	launch: AssistantActionChatLaunchPayload,
): string {
	const params = new URLSearchParams({ query: launch.input });

	return createAssistantActionChatUrl({
		messageUrl: `/?${params.toString()}`,
		enabledTools: launch.enabledTools,
		actionContext: launch.requestOptions?.recipe
			? {
					action: {
						kind: "recipe",
						recipe: launch.requestOptions.recipe,
					},
				}
			: undefined,
	});
}

export function createAppAssistantActionLaunch(
	source: AppAssistantActionLaunchSource,
): AssistantActionNavigationLaunchPayload {
	if (!source.appId) {
		throw new Error("This app cannot open because its identifier is missing.");
	}

	if (source.appKind === "frontend" && source.href) {
		return { navigationPath: source.href };
	}

	return {
		navigationPath: `/apps?app=${encodeURIComponent(source.appId)}`,
	};
}

export function createConnectorAssistantActionLaunch(
	source: ConnectorAssistantActionLaunchSource,
): AssistantActionNavigationLaunchPayload | AssistantActionExternalLaunchPayload {
	if (!source.provider) {
		throw new Error("This connector cannot open because its provider is missing.");
	}

	if (source.authType === "api_key") {
		const params = new URLSearchParams({
			tab: "providers",
			type: "connector",
			connector: source.provider,
		});

		return {
			navigationPath: `/profile?${params.toString()}`,
		};
	}

	if (!source.authorizationUrl) {
		throw new Error("This connector cannot open because its authorization URL is missing.");
	}

	return {
		externalUrl: source.authorizationUrl,
	};
}
