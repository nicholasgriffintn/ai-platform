import type {
	AssistantActionContextPayload,
	AssistantActionItemMetadata,
	RecipeChatSetupResponse,
} from "@assistant/schemas";
import {
	createAssistantRecipeActionContext,
	normaliseAssistantActionToolIds,
	readAssistantActionRequestOptions,
} from "@assistant/schemas";

import type { ChatRequestOptions } from "~/types";

const ACTION_CONTEXT_PARAM = "assistant_action_context";
const LEGACY_RECIPE_CONTEXT_PARAM = "recipe_context";
const AUTO_SUBMIT_PARAM = "auto_submit";

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
		enabledTools: normaliseAssistantActionToolIds(params.get("enabled_tools") ?? undefined),
		hasEnabledTools: params.has("enabled_tools"),
		actionContext: params.get(ACTION_CONTEXT_PARAM),
		recipeContext: params.get(LEGACY_RECIPE_CONTEXT_PARAM),
		autoSubmit: params.get(AUTO_SUBMIT_PARAM) === "1",
	};
}

export function loadAssistantActionRequestOptions(
	state: Pick<AssistantActionLaunchState, "actionContext" | "recipeContext">,
): ChatRequestOptions | undefined {
	return readAssistantActionRequestOptions(
		parseJson(state.actionContext),
		parseJson(state.recipeContext),
	);
}

export function createAssistantActionChatUrl(launch: AssistantActionChatLaunch): string {
	const [path, search = ""] = launch.messageUrl.split("?");
	const params = new URLSearchParams(search);
	const enabledTools = normaliseAssistantActionToolIds(launch.enabledTools);

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
		actionContext: createAssistantRecipeActionContext(response),
	});
}

export function createRecipeAssistantActionLaunch(
	response: RecipeChatSetupResponse,
): AssistantActionChatLaunchPayload {
	const requestOptions = loadAssistantActionRequestOptions({
		actionContext: JSON.stringify(createAssistantRecipeActionContext(response)),
		recipeContext: null,
	});

	return {
		input: response.conversationStarter,
		enabledTools: normaliseAssistantActionToolIds(response.enabledTools),
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
