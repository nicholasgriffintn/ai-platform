import type { AssistantRecipeInstallResponse, RecipeInvocationResponse } from "@assistant/schemas";
import { recipeConfigurationSchema, recipeConnectorProviderSchema } from "@assistant/schemas";

import { isRecord } from "./objects";
import type { ChatRequestOptions } from "~/types";

const RECIPE_CONTEXT_PARAM = "recipe_context";
const AUTO_SUBMIT_PARAM = "auto_submit";
const TOOL_ID_PATTERN = /^[a-zA-Z0-9_:-]+$/;

type RecipeChatSetupResponse = AssistantRecipeInstallResponse | RecipeInvocationResponse;
type RecipeRequestOptions = NonNullable<ChatRequestOptions["recipe"]>;
type RecipeChannel = NonNullable<RecipeRequestOptions["channel"]>;
interface RecipeContextPayload {
	recipe: RecipeRequestOptions;
}

export interface ChatUrlState {
	query: string | null;
	enabledTools: string[];
	hasEnabledTools: boolean;
	recipeContext: string | null;
	autoSubmit: boolean;
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

function createRecipeContextPayload(response: RecipeChatSetupResponse): RecipeContextPayload {
	if ("recipe" in response) {
		return {
			recipe: {
				id: response.recipe.id,
				installationId: response.installation?.id,
				channel: "web",
				allowedConnectorProviders: response.allowedConnectorProviders ?? [],
				allowedConnectorOperations: response.allowedConnectorOperations ?? {},
				configuration: response.installation?.configuration ?? {},
			},
		};
	}

	return {
		recipe: {
			id: response.recipeId,
			installationId: response.installationId,
			channel: response.channel,
			allowedConnectorProviders: response.allowedConnectorProviders ?? [],
			allowedConnectorOperations: response.allowedConnectorOperations ?? {},
			configuration: response.configuration,
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

function readRecipeContextPayload(value: unknown): RecipeContextPayload | undefined {
	if (!isRecord(value) || !isRecord(value.recipe) || typeof value.recipe.id !== "string") {
		return undefined;
	}

	const configuration = recipeConfigurationSchema.safeParse(value.recipe.configuration);

	return {
		recipe: {
			id: value.recipe.id,
			installationId:
				typeof value.recipe.installationId === "string" ? value.recipe.installationId : undefined,
			channel: readRecipeChannel(value.recipe.channel),
			allowedConnectorProviders: readConnectorProviders(value.recipe.allowedConnectorProviders),
			allowedConnectorOperations: readConnectorOperations(value.recipe.allowedConnectorOperations),
			configuration: configuration.success ? configuration.data : {},
		},
	};
}

export function parseChatUrlState(search: string): ChatUrlState {
	const params = new URLSearchParams(search);

	return {
		query: params.get("query"),
		enabledTools: normaliseToolIds(params.get("enabled_tools") ?? undefined),
		hasEnabledTools: params.has("enabled_tools"),
		recipeContext: params.get(RECIPE_CONTEXT_PARAM),
		autoSubmit: params.get(AUTO_SUBMIT_PARAM) === "1",
	};
}

export function loadRecipeChatRequestOptions(
	recipeContext: string | null,
): ChatRequestOptions | undefined {
	if (!recipeContext) {
		return undefined;
	}

	try {
		const payload = readRecipeContextPayload(JSON.parse(recipeContext));
		return payload ? { recipe: payload.recipe } : undefined;
	} catch {
		return undefined;
	}
}

export function createRecipeChatUrl(messageUrl: string, response: RecipeChatSetupResponse): string {
	const [path, search = ""] = messageUrl.split("?");
	const params = new URLSearchParams(search);
	const enabledTools = normaliseToolIds(response.enabledTools);

	params.set("enabled_tools", enabledTools.join(","));
	params.set(AUTO_SUBMIT_PARAM, "1");
	params.set(RECIPE_CONTEXT_PARAM, JSON.stringify(createRecipeContextPayload(response)));

	const query = params.toString();
	return query ? `${path}?${query}` : path;
}
