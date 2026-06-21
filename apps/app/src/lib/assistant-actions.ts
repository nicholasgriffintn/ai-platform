import type {
	AssistantActionCatalog,
	AssistantActionItem,
	AssistantRecipe,
	RecipeConnectorManifest,
	RecipeInstallation,
} from "@assistant/schemas";
import { assistantActionVerbs } from "@assistant/schemas";

import type { ModelToolDefinition } from "./model-tools";
import type { AppListItem } from "~/types/apps";

export type { AssistantActionCatalog, AssistantActionItem };

interface AgentActionSource {
	id: string;
	name: string;
	description?: string;
	model?: string;
}

interface AssistantActionCatalogSources {
	agents?: readonly AgentActionSource[];
	apps?: readonly AppListItem[];
	connectors?: readonly RecipeConnectorManifest[];
	installations?: readonly RecipeInstallation[];
	modelTools?: readonly ModelToolDefinition[];
	recipes?: readonly AssistantRecipe[];
}

function nonEmptyText(value: string | undefined): string[] {
	const trimmed = value?.trim();
	return trimmed ? [trimmed] : [];
}

function buildInstalledRecipeItems(
	recipes: readonly AssistantRecipe[],
	installations: readonly RecipeInstallation[],
): AssistantActionItem[] {
	const recipeById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

	return installations.flatMap((installation) => {
		const recipe = recipeById.get(installation.recipeId);
		if (!recipe) {
			return [];
		}

		return [createRecipeAssistantActionItem(recipe, installation)];
	});
}

function buildRecipeItems(
	recipes: readonly AssistantRecipe[],
	installations: readonly RecipeInstallation[],
): AssistantActionItem[] {
	const installedRecipeIds = new Set(installations.map((installation) => installation.recipeId));

	return recipes
		.filter((recipe) => !installedRecipeIds.has(recipe.id))
		.map((recipe) => createRecipeAssistantActionItem(recipe));
}

export function createRecipeAssistantActionItem(
	recipe: AssistantRecipe,
	installation?: RecipeInstallation,
): AssistantActionItem {
	return {
		id: installation ? `installed_recipe:${installation.id}` : `recipe:${recipe.id}`,
		kind: installation ? "installed_recipe" : "recipe",
		label: recipe.title,
		description: recipe.summary,
		status: installation?.status ?? "available",
		searchText: [
			recipe.title,
			recipe.summary,
			recipe.description,
			recipe.category,
			...recipe.actions,
		],
		metadata: {
			recipeId: recipe.id,
			installationId: installation?.id,
		},
	};
}

export function buildAssistantActionCatalog(
	sources: AssistantActionCatalogSources,
): AssistantActionCatalog {
	const recipes = sources.recipes ?? [];
	const installations = sources.installations ?? [];

	return {
		verbs: assistantActionVerbs,
		items: [
			...buildInstalledRecipeItems(recipes, installations),
			...buildRecipeItems(recipes, installations),
			...(sources.apps ?? []).map((app) => ({
				id: `app:${app.id}`,
				kind: "app" as const,
				label: app.name,
				description: app.description,
				status: app.type,
				searchText: [
					app.name,
					...nonEmptyText(app.description),
					...nonEmptyText(app.category),
					...(app.tags ?? []),
				],
				metadata: {
					appId: app.id,
					appKind: app.kind,
					href: app.href,
				},
			})),
			...(sources.agents ?? []).map((agent) => ({
				id: `agent:${agent.id}`,
				kind: "agent" as const,
				label: agent.name,
				description: agent.description,
				status: agent.model,
				searchText: [agent.name, ...nonEmptyText(agent.description), ...nonEmptyText(agent.model)],
				metadata: {
					agentId: agent.id,
				},
			})),
			...(sources.connectors ?? []).map((connector) =>
				createConnectorAssistantActionItem(connector),
			),
			...(sources.modelTools ?? []).map((tool) => ({
				id: `tool:${tool.id}`,
				kind: "tool" as const,
				label: tool.label,
				description: tool.description,
				searchText: [tool.label, tool.command, tool.description, tool.id],
				metadata: {
					toolId: tool.id,
				},
			})),
		],
	};
}

export function createConnectorAssistantActionItem(
	connector: RecipeConnectorManifest,
): AssistantActionItem {
	return {
		id: `connector:${connector.id}`,
		kind: "connector",
		label: connector.name,
		description: connector.description,
		status: connector.status,
		searchText: [
			connector.name,
			connector.description,
			connector.id,
			connector.status,
			...connector.operations,
		],
		metadata: {
			authType: connector.authType,
			provider: connector.id,
		},
	};
}

export function formatAssistantActionMention(item: Pick<AssistantActionItem, "label">): string {
	return `@${item.label}`;
}
