import type {
	AssistantActionNotification,
	AssistantActionResult,
	AssistantActionSelectionItem,
	AssistantRecipeInstallResponse,
	RecipeConnectorProvider,
	RecipeConnectorStartResponse,
	RecipeInvocationResponse,
} from "@assistant/schemas";
import { recipeConnectorProviderSchema } from "@assistant/schemas";

import {
	createAppAssistantActionLaunch,
	createConnectorAssistantActionLaunch,
	createRecipeAssistantActionLaunch,
} from "./assistant-action-launch";
import { mergeToolSelection } from "./assistant-action-submit";
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

	if (item.kind === "installed_recipe" || item.kind === "recipe") {
		const recipeId = readRecipeId(item);
		if (!recipeId) {
			return createMissingRecipeIdResult(action.input);
		}

		const response =
			item.kind === "installed_recipe"
				? await dependencies.invokeRecipe(recipeId, action.input)
				: await dependencies.installRecipe(recipeId);
		const launch = createRecipeAssistantActionLaunch(response);

		return {
			kind: "submit",
			input: action.input.trim() ? action.input : launch.input,
			requestOptions: launch.requestOptions,
			selectedTools: launch.enabledTools,
		};
	}

	if (item.kind === "tool" && item.metadata?.toolId) {
		return {
			kind: "submit",
			input: action.input,
			selectedTools: mergeToolSelection(action.selectedTools ?? [], item.metadata.toolId),
		};
	}

	if (item.kind === "app") {
		const launch = createAppAssistantActionLaunch({
			appId: item.metadata?.appId,
			appKind: item.metadata?.appKind,
			href: item.metadata?.href,
		});

		return {
			kind: "navigation",
			input: action.input,
			path: launch.navigationPath,
		};
	}

	if (item.kind === "connector") {
		const parsedProvider = recipeConnectorProviderSchema.safeParse(item.metadata?.provider);
		if (!parsedProvider.success) {
			throw new Error("This connector cannot open because its provider is missing.");
		}

		const authorization =
			item.metadata?.authType === "api_key"
				? undefined
				: await dependencies.startConnector(
						parsedProvider.data,
						action.connectorReturnTo ?? "/profile?tab=providers&type=connector",
					);
		const launch = createConnectorAssistantActionLaunch({
			authType: item.metadata?.authType,
			authorizationUrl: authorization?.authorizationUrl,
			provider: parsedProvider.data,
		});

		if (launch.externalUrl) {
			return {
				kind: "external",
				input: action.input,
				url: launch.externalUrl,
			};
		}
		if (!launch.navigationPath) {
			throw new Error("This connector cannot open because its navigation path is missing.");
		}

		return {
			kind: "navigation",
			input: action.input,
			path: launch.navigationPath,
		};
	}

	return createUnsupportedActionResult(action.input, item);
}
