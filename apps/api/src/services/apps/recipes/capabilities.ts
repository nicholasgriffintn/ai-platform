import type { AssistantCapabilityDescriptor, AssistantRecipe } from "@assistant/schemas";

import { normaliseAssistantCapabilityTags } from "~/services/assistant-capabilities";

function getRecipeKindCapabilityTag(recipe: AssistantRecipe): string {
	if (recipe.kind === "automate") {
		return "automation";
	}

	return recipe.kind;
}

export function createRecipeCapabilityDescriptor(
	recipe: AssistantRecipe,
): AssistantCapabilityDescriptor {
	return {
		id: recipe.id,
		kind: "recipe",
		name: recipe.title,
		description: recipe.summary,
		availability: "available",
		launch: {
			method: "conversation",
			action: "recipe_chat",
		},
		executionMode: "workflow",
		authRequirement: "pro",
		requiredModelCapabilities: [],
		requiredConnectors: recipe.integrations
			.filter((integration) => integration.requiresConnection !== false)
			.map((integration) => ({
				provider: integration.providerId,
				state: integration.connectionStatus ?? "unknown",
			})),
		savedState: {
			supported: true,
			kind: "installation",
		},
		tags: normaliseAssistantCapabilityTags([recipe.category, getRecipeKindCapabilityTag(recipe)]),
	};
}
