import type {
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
import type { AssistantActionItem } from "./assistant-actions";
import type { ChatRequestOptions } from "~/types";

type ExecutableAssistantActionItem = Pick<
	AssistantActionItem,
	"id" | "kind" | "label" | "metadata"
>;

export interface AssistantActionExecutionInput {
	connectorReturnTo?: string;
	input: string;
	item?: ExecutableAssistantActionItem;
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

interface AssistantActionExecutionNotification {
	message: string;
	type: "error";
}

export interface AssistantActionExecutionResult {
	externalUrl?: string;
	input: string;
	navigationPath?: string;
	notification?: AssistantActionExecutionNotification;
	requestOptions?: ChatRequestOptions;
	selectedTools?: string[];
}

function readRecipeId(item: ExecutableAssistantActionItem): string | undefined {
	return item.metadata?.recipeId;
}

function createMissingRecipeIdResult(input: string): AssistantActionExecutionResult {
	return {
		input,
		notification: {
			type: "error",
			message: "This recipe cannot run because its identifier is missing.",
		},
	};
}

function createUnsupportedActionResult(
	input: string,
	item: ExecutableAssistantActionItem,
): AssistantActionExecutionResult {
	return {
		input,
		notification: {
			type: "error",
			message: `${item.label} is not executable from the composer yet.`,
		},
	};
}

export async function executeAssistantAction(
	action: AssistantActionExecutionInput,
	dependencies: AssistantActionExecutionDependencies,
): Promise<AssistantActionExecutionResult> {
	const item = action.item;
	if (!item) {
		return { input: action.input };
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
			input: action.input.trim() ? action.input : launch.input,
			requestOptions: launch.requestOptions,
			selectedTools: launch.enabledTools,
		};
	}

	if (item.kind === "tool" && item.metadata?.toolId) {
		return {
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
			input: action.input,
			navigationPath: launch.navigationPath,
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

		return {
			externalUrl: launch.externalUrl,
			input: action.input,
			navigationPath: launch.navigationPath,
		};
	}

	return createUnsupportedActionResult(action.input, item);
}
