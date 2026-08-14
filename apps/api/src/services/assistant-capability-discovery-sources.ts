import type {
	AssistantRecipe,
	RecipeConnectorManifest,
	RecipeInstallation,
} from "@ngriffin_uk/polychat-schemas";
import { CAPABILITY_DISCOVERY_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";

import type { IRequest } from "~/types";
import { formatFunctionName } from "~/utils/functions";
import { listRecipeConnectors } from "~/services/apps/connectors";
import { listAssistantRecipes, listRecipeInstallations } from "~/services/apps/recipes";
import { listFunctionTools } from "~/services/functions";
import { resolveEnabledFunctionToolNames } from "~/services/functions/availability";
import { requireProjectAccess } from "~/services/workspaces/access";
import { resolveProjectTools } from "~/services/workspaces/projectTools";
import {
	type CapabilityDiscoverySources,
	type DiscoverableFunctionTool,
} from "./assistant-capability-discovery";

interface ProjectCapabilityReference {
	kind: string;
	capability_id: string;
}

const INTERNAL_FUNCTION_TOOLS = new Set([
	"add_reasoning_step",
	"ask_user",
	"compose_functions",
	"configure_recipe",
	"delegate_to_team_member",
	"delegate_to_team_member_by_role",
	"fallback",
	"get_recipe",
	"get_team_members",
	"if_then_else",
	"parallel_execute",
	"request_approval",
	"retry_with_backoff",
	"search_pashi_tools",
	"trigger_recipe",
	"use_recipe_connector",
]);

export function scopeCapabilityDiscoverySourcesToProject(params: {
	connectors: readonly RecipeConnectorManifest[];
	enabledToolIds: ReadonlySet<string>;
	recipes: readonly AssistantRecipe[];
	references: readonly ProjectCapabilityReference[];
	tools: readonly DiscoverableFunctionTool[];
}): Pick<CapabilityDiscoverySources, "connectors" | "recipes" | "tools"> {
	const recipeIds = new Set(
		params.references
			.filter((capability) => capability.kind === "recipe")
			.map((capability) => capability.capability_id),
	);
	const recipes = params.recipes.filter((recipe) => recipeIds.has(recipe.id));
	const connectorIds = new Set(
		recipes.flatMap((recipe) =>
			recipe.integrations
				.filter((integration) => integration.requiresConnection !== false)
				.map((integration) => integration.providerId),
		),
	);

	return {
		recipes,
		connectors: params.connectors.filter((connector) => connectorIds.has(connector.id)),
		tools: params.tools.filter((tool) => params.enabledToolIds.has(tool.id)),
	};
}

export async function loadCapabilityDiscoverySources(
	request: IRequest,
): Promise<CapabilityDiscoverySources> {
	const user = request.user;
	const context = request.context;
	let tools: DiscoverableFunctionTool[] = listFunctionTools()
		.filter(
			(tool) =>
				tool.name !== CAPABILITY_DISCOVERY_TOOL_NAME && !INTERNAL_FUNCTION_TOOLS.has(tool.name),
		)
		.map((tool) => ({
			id: tool.name,
			name: formatFunctionName(tool.name),
			description: tool.description,
			type: tool.type,
		}));
	let recipes: AssistantRecipe[] = [];
	let connectors: RecipeConnectorManifest[] = [];
	let installations: RecipeInstallation[] = [];

	if (user?.id && context) {
		const projectId =
			request.memoryScope?.type === "project" ? request.memoryScope.projectId : undefined;
		if (projectId) await requireProjectAccess(context, projectId);

		const connectorList = await listRecipeConnectors({
			context,
			userId: user.id,
			requestUrl: request.app_url,
		});
		const [recipeList, installationList] = await Promise.all([
			listAssistantRecipes({
				context,
				userId: user.id,
				requestUrl: request.app_url,
				connectors: connectorList.connectors,
			}),
			listRecipeInstallations({
				context,
				userId: user.id,
				...(projectId ? { projectId } : {}),
			}),
		]);

		recipes = recipeList.recipes;
		connectors = connectorList.connectors;
		installations = installationList.installations.filter(
			(installation) => installation.userId === user.id,
		);

		if (projectId) {
			const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
			const projectSources = scopeCapabilityDiscoverySourcesToProject({
				connectors,
				enabledToolIds: new Set(resolveProjectTools(capabilities).enabledTools),
				recipes,
				references: capabilities,
				tools,
			});
			recipes = [...projectSources.recipes];
			connectors = [...projectSources.connectors];
			tools = [...projectSources.tools];
		}
	}

	return {
		connectors,
		enabledToolIds: resolveEnabledFunctionToolNames(request.request?.enabled_tools, user),
		installations,
		isPro: user?.plan_id === "pro",
		isSignedIn: Boolean(user?.id),
		...(request.memoryScope?.type === "project"
			? { projectId: request.memoryScope.projectId }
			: {}),
		recipes,
		tools,
	};
}
