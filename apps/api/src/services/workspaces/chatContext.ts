import {
	projectCodingEnvironmentSchema,
	type ChatHostedToolSettings,
	type SandboxRequestOptions,
} from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import type { CoreChatOptions } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import {
	assistantRecipes,
	RECIPE_LOOKUP_TOOL,
	RECIPE_SETUP_TOOL,
} from "~/services/apps/recipes/catalog";
import { requireProjectAccess } from "./access";
import { resolveProjectTools } from "./projectTools";

export interface ProjectChatContext {
	projectId: string;
	instructions: string;
	enabledTools: string[];
	toolOptions?: ChatHostedToolSettings;
	sandboxOptions?: SandboxRequestOptions;
}

const PROJECT_CODING_TOOL_IDS = [
	"run_feature_implementation",
	"run_code_review",
	"run_test_suite",
	"run_bug_fix",
	"run_refactoring",
	"run_documentation",
	"run_migration",
];

export function applyProjectCodingEnvironment(
	options: Pick<CoreChatOptions, "options">,
	projectContext: ProjectChatContext | null,
): Pick<CoreChatOptions, "options"> {
	if (!projectContext?.sandboxOptions) return options;

	return {
		...options,
		options: {
			...options.options,
			sandbox: {
				...options.options?.sandbox,
				...projectContext.sandboxOptions,
				taskType: options.options?.sandbox?.taskType ?? projectContext.sandboxOptions.taskType,
				enabled: true,
			},
		},
	};
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
	const projectTools = resolveProjectTools(capabilities);
	const codingEnvironment = projectCodingEnvironmentSchema.safeParse({
		installationId: project.coding_installation_id,
		repository: project.coding_repository,
		promptStrategy: project.coding_prompt_strategy,
		shouldCommit: Boolean(project.coding_should_commit),
		timeoutSeconds: project.coding_timeout_seconds,
	});
	const toolIds = [
		...projectTools.enabledTools,
		...(project.coding_enabled === 1 && codingEnvironment.success ? PROJECT_CODING_TOOL_IDS : []),
	];
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
		toolOptions: projectTools.toolOptions,
		sandboxOptions:
			project.coding_enabled === 1 && codingEnvironment.success
				? {
						enabled: true,
						installationId: codingEnvironment.data.installationId,
						repo: codingEnvironment.data.repository,
						taskType: "feature-implementation",
						promptStrategy: codingEnvironment.data.promptStrategy,
						shouldCommit: codingEnvironment.data.shouldCommit,
						timeoutSeconds: codingEnvironment.data.timeoutSeconds,
					}
				: undefined,
	};
}
