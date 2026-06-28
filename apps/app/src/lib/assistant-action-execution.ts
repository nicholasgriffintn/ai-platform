import type {
	AssistantActionLaunch,
	AssistantActionNotification,
	AssistantActionResult,
	AssistantActionSelectionItem,
	AssistantRecipeInstallResponse,
	RecipeConnectorProvider,
	RecipeConnectorStartResponse,
	RecipeInvocationResponse,
} from "@assistant/schemas";
import { mergeAssistantActionToolIds, recipeConnectorProviderSchema } from "@assistant/schemas";

import {
	createAppAssistantActionLaunch,
	createConnectorAssistantActionLaunch,
	createRecipeAssistantActionLaunch,
} from "./assistant-action-launch";
import type { ChatRequestOptions } from "~/types";

export interface AssistantActionExecutionInput {
	connectorReturnTo?: string;
	input: string;
	item?: AssistantActionSelectionItem;
	selectedTools?: string[];
}

export interface AssistantActionExecutionDependencies {
	installRecipe: (recipeId: string) => Promise<AssistantRecipeInstallResponse>;
	invokeRecipe: (recipeId: string, input: string) => Promise<RecipeInvocationResponse>;
	startConnector: (
		provider: RecipeConnectorProvider,
		returnTo?: string,
	) => Promise<RecipeConnectorStartResponse>;
}

function readRecipeId(item: AssistantActionSelectionItem): string | undefined {
	return item.metadata?.recipeId;
}

function readLaunch(item: AssistantActionSelectionItem): AssistantActionLaunch | undefined {
	if (item.launch) {
		return item.launch;
	}

	if (item.kind === "installed_recipe" || item.kind === "recipe") {
		const recipeId = readRecipeId(item);
		if (!recipeId) {
			return undefined;
		}

		return {
			kind: "conversation",
			operation: item.kind === "installed_recipe" ? "invoke_recipe" : "install_recipe",
			recipeId,
			installationId: item.metadata?.installationId,
		};
	}

	if (item.kind === "tool" && item.metadata?.toolId) {
		return {
			kind: "tool_toggle",
			toolId: item.metadata.toolId,
		};
	}

	if (item.kind === "app") {
		return {
			kind: "navigation",
			path: createAppAssistantActionLaunch({
				appId: item.metadata?.appId,
				appKind: item.metadata?.appKind,
				href: item.metadata?.href,
			}).navigationPath,
		};
	}

	if (item.kind === "connector") {
		const parsedProvider = recipeConnectorProviderSchema.safeParse(item.metadata?.provider);
		if (!parsedProvider.success) {
			throw new Error("This connector cannot open because its provider is missing.");
		}

		if (item.metadata?.authType === "api_key") {
			const connectorLaunch = createConnectorAssistantActionLaunch({
				authType: item.metadata?.authType,
				provider: parsedProvider.data,
			});
			return connectorLaunch.navigationPath
				? { kind: "navigation", path: connectorLaunch.navigationPath }
				: undefined;
		}

		return {
			kind: "external",
			authType: item.metadata?.authType,
			provider: parsedProvider.data,
		};
	}

	return undefined;
}

function createErrorSubmitResult(
	input: string,
	notification: AssistantActionNotification,
): AssistantActionResult {
	return {
		kind: "submit",
		input,
		notification,
	};
}

function createMissingRecipeIdResult(input: string): AssistantActionResult {
	return createErrorSubmitResult(input, {
		type: "error",
		message: "This recipe cannot run because its identifier is missing.",
	});
}

function createUnsupportedActionResult(input: string, item: AssistantActionSelectionItem) {
	return createErrorSubmitResult(input, {
		type: "error",
		message: `${item.label} is not executable from the composer yet.`,
	});
}

function createSubmitResult(
	input: string,
	result: {
		notification?: AssistantActionNotification;
		requestOptions?: ChatRequestOptions;
		selectedTools?: string[];
	},
): AssistantActionResult {
	return {
		kind: "submit",
		input,
		...(result.notification ? { notification: result.notification } : {}),
		...(result.requestOptions ? { requestOptions: result.requestOptions } : {}),
		...(result.selectedTools ? { selectedTools: result.selectedTools } : {}),
	};
}

export async function executeAssistantAction(
	action: AssistantActionExecutionInput,
	dependencies: AssistantActionExecutionDependencies,
): Promise<AssistantActionResult> {
	const item = action.item;
	if (!item) {
		return createSubmitResult(action.input, {});
	}
	const launch = readLaunch(item);

	if (!launch) {
		return createUnsupportedActionResult(action.input, item);
	}

	if (launch.kind === "conversation") {
		if (launch.operation === "ask_agent") {
			return createUnsupportedActionResult(action.input, item);
		}
		const recipeId = launch.recipeId;
		if (!recipeId) {
			return createMissingRecipeIdResult(action.input);
		}

		const response =
			launch.operation === "invoke_recipe"
				? await dependencies.invokeRecipe(recipeId, action.input)
				: await dependencies.installRecipe(recipeId);
		const chatLaunch = createRecipeAssistantActionLaunch(response);

		return {
			kind: "submit",
			input: action.input.trim() ? action.input : chatLaunch.input,
			requestOptions: chatLaunch.requestOptions,
			selectedTools: chatLaunch.enabledTools,
		};
	}

	if (launch.kind === "tool_toggle") {
		return {
			kind: "submit",
			input: action.input,
			selectedTools: mergeAssistantActionToolIds(action.selectedTools ?? [], launch.toolId),
		};
	}

	if (launch.kind === "navigation") {
		return {
			kind: "navigation",
			input: action.input,
			path: launch.path,
		};
	}

	if (launch.kind === "external") {
		if (launch.url) {
			return {
				kind: "external",
				input: action.input,
				url: launch.url,
			};
		}

		const parsedProvider = recipeConnectorProviderSchema.safeParse(launch.provider);
		if (!parsedProvider.success) {
			throw new Error("This connector cannot open because its provider is missing.");
		}

		const authorization = await dependencies.startConnector(
			parsedProvider.data,
			action.connectorReturnTo ?? "/profile?tab=providers&type=connector",
		);
		const connectorLaunch = createConnectorAssistantActionLaunch({
			authType: launch.authType,
			authorizationUrl: authorization?.authorizationUrl,
			provider: parsedProvider.data,
		});

		if (connectorLaunch.externalUrl) {
			return {
				kind: "external",
				input: action.input,
				url: connectorLaunch.externalUrl,
			};
		}
		if (!connectorLaunch.navigationPath) {
			throw new Error("This connector cannot open because its navigation path is missing.");
		}

		return {
			kind: "navigation",
			input: action.input,
			path: connectorLaunch.navigationPath,
		};
	}

	if (launch.kind === "schedule") {
		const params = new URLSearchParams({
			action: "schedule",
			recipe: launch.recipeId,
		});

		return {
			input: action.input,
			kind: "navigation",
			path: `/apps/recipes?${params.toString()}`,
		};
	}

	return createUnsupportedActionResult(action.input, item);
}
