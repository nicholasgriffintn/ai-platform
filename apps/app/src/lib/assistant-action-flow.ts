import type {
	AssistantActionDelivery,
	AssistantActionResult,
	AssistantActionVerb,
} from "@assistant/schemas";

import {
	executeAssistantAction,
	type AssistantActionExecutionDependencies,
	type AssistantActionExecutionInput,
} from "./assistant-action-execution";
import { createAssistantActionConversationUrl } from "./assistant-action-launch";

interface AssistantActionFlowInput extends AssistantActionExecutionInput {
	delivery: AssistantActionDelivery;
	verb?: Pick<AssistantActionVerb, "command" | "id">;
}

export async function launchAssistantAction(
	action: AssistantActionFlowInput,
	dependencies: AssistantActionExecutionDependencies,
): Promise<AssistantActionResult> {
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
	if (
		result.kind === "submit" &&
		action.delivery === "conversation" &&
		(result.requestOptions || result.selectedTools)
	) {
		return {
			kind: "conversation",
			input: result.input,
			...(result.notification ? { notification: result.notification } : {}),
			...(result.requestOptions ? { requestOptions: result.requestOptions } : {}),
			...(result.selectedTools ? { selectedTools: result.selectedTools } : {}),
			url: createAssistantActionConversationUrl({
				input: result.input,
				enabledTools: result.selectedTools ?? [],
				requestOptions: result.requestOptions,
			}),
		};
	}

	return result;
}
