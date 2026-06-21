import {
	executeAssistantAction,
	type AssistantActionExecutionDependencies,
	type AssistantActionExecutionInput,
} from "./assistant-action-execution";
import { createAssistantActionConversationUrl } from "./assistant-action-launch";
import type { ChatRequestOptions } from "~/types";

type AssistantActionDelivery = "conversation" | "submit";

interface AssistantActionFlowInput extends AssistantActionExecutionInput {
	delivery: AssistantActionDelivery;
	verb?: {
		command: string;
		id: string;
	};
}

interface AssistantActionFlowBaseResult {
	input: string;
	notification?: {
		message: string;
		type: "error";
	};
	selectedTools?: string[];
}

export interface AssistantActionSubmitFlowResult extends AssistantActionFlowBaseResult {
	kind: "submit";
	requestOptions?: ChatRequestOptions;
}

export interface AssistantActionConversationFlowResult extends AssistantActionFlowBaseResult {
	kind: "conversation";
	requestOptions?: ChatRequestOptions;
	url: string;
}

export interface AssistantActionNavigationFlowResult extends AssistantActionFlowBaseResult {
	kind: "navigation";
	path: string;
}

export interface AssistantActionExternalFlowResult extends AssistantActionFlowBaseResult {
	kind: "external";
	url: string;
}

export type AssistantActionFlowResult =
	| AssistantActionConversationFlowResult
	| AssistantActionExternalFlowResult
	| AssistantActionNavigationFlowResult
	| AssistantActionSubmitFlowResult;

export async function launchAssistantAction(
	action: AssistantActionFlowInput,
	dependencies: AssistantActionExecutionDependencies,
): Promise<AssistantActionFlowResult> {
	if (
		action.verb?.command === "schedule" &&
		(action.item?.kind === "recipe" || action.item?.kind === "installed_recipe")
	) {
		const recipeId = action.item.metadata?.recipeId;
		if (!recipeId) {
			return {
				input: action.input,
				kind: "submit",
				notification: {
					type: "error",
					message: "This recipe cannot be scheduled because its identifier is missing.",
				},
			};
		}

		const params = new URLSearchParams({
			action: "schedule",
			recipe: recipeId,
		});

		return {
			input: action.input,
			kind: "navigation",
			path: `/apps/recipes?${params.toString()}`,
		};
	}

	const result = await executeAssistantAction(action, dependencies);
	const base = {
		input: result.input,
		...(result.notification ? { notification: result.notification } : {}),
		...(result.selectedTools ? { selectedTools: result.selectedTools } : {}),
	};

	if (result.externalUrl) {
		return {
			...base,
			kind: "external",
			url: result.externalUrl,
		};
	}

	if (result.navigationPath) {
		return {
			...base,
			kind: "navigation",
			path: result.navigationPath,
		};
	}

	if (action.delivery === "conversation" && (result.requestOptions || result.selectedTools)) {
		return {
			...base,
			kind: "conversation",
			...(result.requestOptions ? { requestOptions: result.requestOptions } : {}),
			url: createAssistantActionConversationUrl({
				input: result.input,
				enabledTools: result.selectedTools ?? [],
				requestOptions: result.requestOptions,
			}),
		};
	}

	return {
		...base,
		kind: "submit",
		...(result.requestOptions ? { requestOptions: result.requestOptions } : {}),
	};
}
