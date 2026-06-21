import type {
	AssistantActionContextPayload,
	AssistantActionItemMetadata,
	RecipeChatSetupResponse,
} from "@assistant/schemas";
import {
	assistantActionContextPayloadSchema,
	assistantLegacyRecipeContextPayloadSchema,
	createRecipeChatRequestOptions,
} from "@assistant/schemas";

import type { ChatRequestOptions } from "~/types";

const ACTION_CONTEXT_PARAM = "assistant_action_context";
const LEGACY_RECIPE_CONTEXT_PARAM = "recipe_context";
const AUTO_SUBMIT_PARAM = "auto_submit";
const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

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

type AppAssistantActionLaunchSource = Pick<
	AssistantActionItemMetadata,
	"appId" | "appKind" | "href"
>;

type ConnectorAssistantActionLaunchSource = Pick<
	AssistantActionItemMetadata,
	"authType" | "provider"
> & {
	authorizationUrl?: string;
};

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

function createRecipeActionContext(
	response: RecipeChatSetupResponse,
): AssistantActionContextPayload {
	return {
		action: {
			kind: "recipe",
			recipe: createRecipeChatRequestOptions(response),
		},
	};
}

function readAssistantActionContextPayload(
	value: unknown,
): AssistantActionContextPayload | undefined {
	const parsed = assistantActionContextPayloadSchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
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

	const legacyRecipePayload = assistantLegacyRecipeContextPayloadSchema.safeParse(
		parseJson(state.recipeContext),
	);
	return legacyRecipePayload.success ? { recipe: legacyRecipePayload.data.recipe } : undefined;
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
