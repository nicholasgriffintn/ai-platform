import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	assistantRecipes,
	RECIPE_LOOKUP_TOOL,
	RECIPE_SETUP_TOOL,
} from "~/services/apps/recipes/catalog";
import { requireProjectAccess } from "./access";

export interface ProjectChatContext {
	projectId: string;
	instructions: string;
	enabledTools: string[];
}

export async function resolveProjectChatContext(
	context: ServiceContext,
	options: Pick<CoreChatOptions, "completion_id" | "enabled_tools" | "metadata" | "options">,
): Promise<ProjectChatContext | null> {
	const conversation = options.completion_id
		? await context.repositories.conversations.getConversation(options.completion_id)
		: null;
	const storedProjectId =
		typeof conversation?.project_id === "string" ? conversation.project_id : undefined;
	const requestedProjectId = options.metadata?.project_id;

	if (conversation && !storedProjectId && requestedProjectId) {
		throw new AssistantError(
			"Start a new conversation to work inside a project",
			ErrorType.CONFLICT_ERROR,
			409,
		);
	}

	if (storedProjectId && requestedProjectId && storedProjectId !== requestedProjectId) {
		throw new AssistantError(
			"The conversation belongs to a different project",
			ErrorType.CONFLICT_ERROR,
			409,
		);
	}

	const projectId = storedProjectId ?? requestedProjectId;
	if (!projectId) return null;

	const { project } = await requireProjectAccess(context, projectId);
	const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
	const toolIds = capabilities
		.filter((capability) => capability.kind === "tool")
		.map((capability) => capability.capability_id);
	const recipeId = options.options?.recipe?.id;
	const hasRecipe =
		recipeId &&
		capabilities.some(
			(capability) => capability.kind === "recipe" && capability.capability_id === recipeId,
		);
	if (hasRecipe) {
		const recipe = assistantRecipes.find((candidate) => candidate.id === recipeId);
		const recipeTools = new Set([
			...(recipe?.enabledTools ?? []),
			RECIPE_LOOKUP_TOOL,
			RECIPE_SETUP_TOOL,
		]);
		toolIds.push(...(options.enabled_tools ?? []).filter((toolId) => recipeTools.has(toolId)));
	}

	return {
		projectId,
		instructions: project.instructions,
		enabledTools: [...new Set(toolIds)],
	};
}
