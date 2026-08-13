import type { AssistantRecipe, RecipeConnectorManifest } from "@assistant/schemas";

import type { RecipeEventTriggerProvider } from "./RecipeEventTriggersDialog";

export function getRecipeEventTriggerProviders(
	recipe: AssistantRecipe,
	connectorByProviderId: Map<string, RecipeConnectorManifest>,
): RecipeEventTriggerProvider[] {
	if (!recipe.triggers.some((trigger) => trigger.type === "event")) return [];
	return recipe.integrations.flatMap((integration) => {
		const connector = connectorByProviderId.get(integration.providerId);
		if (
			integration.connectionStatus !== "connected" ||
			connector?.authType !== "composio" ||
			connector.status !== "connected"
		) {
			return [];
		}
		return [{ id: connector.id, name: integration.name || connector.name }];
	});
}
