import {
  PROJECT_TASK_TOOL_IDS,
  sandboxDeliveryPolicyCreatesCommit,
  type ChatHostedToolSettings,
  type RecipeConnectorProvider,
  type SandboxRequestOptions,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import {
  assistantRecipes,
  RECIPE_LOOKUP_TOOL,
  RECIPE_SETUP_TOOL,
} from "~/services/apps/recipes/catalog";
import { resolveProjectSkillGrants } from "~/services/skills/scope";
import type { CoreChatOptions } from "~/types";

import { resolveChatProjectAccess } from "./chatProjectAccess";
import {
  PROJECT_CODING_TOOL_IDS,
  resolveProjectCodingEnvironment,
} from "./projectCodingEnvironment";
import { resolveProjectRecipeConnectorScope } from "./projectRecipeConnectorScope";
import { resolveProjectTools } from "./projectTools";

export interface ProjectChatContext {
  projectId: string;
  instructions: string;
  enabledTools: string[];
  enabledSkillIds: string[];
  connectorProviders: RecipeConnectorProvider[];
  toolOptions?: ChatHostedToolSettings;
  sandboxOptions?: SandboxRequestOptions;
}

export function applyProjectCodingEnvironment(
  options: Pick<CoreChatOptions, "options">,
  projectContext: ProjectChatContext | null,
): Pick<CoreChatOptions, "options"> {
  if (!projectContext?.sandboxOptions) {
    return options;
  }

  return {
    ...options,
    options: {
      ...options.options,
      sandbox: {
        ...options.options?.sandbox,
        ...projectContext.sandboxOptions,
        model: projectContext.sandboxOptions.model,
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
  const access = await resolveChatProjectAccess(context, options);

  if (!access) {
    return null;
  }

  const { project } = access;
  const projectId = project.id;
  const capabilities = await context.repositories.workspaces.listProjectCapabilities(projectId);
  const projectTools = resolveProjectTools(capabilities);
  const codingEnvironment = resolveProjectCodingEnvironment(project);
  const toolIds = [
    ...projectTools.enabledTools,
    ...PROJECT_TASK_TOOL_IDS,
    ...(codingEnvironment ? PROJECT_CODING_TOOL_IDS : []),
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
    enabledSkillIds: resolveProjectSkillGrants(capabilities),
    connectorProviders: resolveProjectRecipeConnectorScope(capabilities).providers,
    toolOptions: projectTools.toolOptions,
    sandboxOptions: codingEnvironment
      ? {
          enabled: true,
          installationId: codingEnvironment.installationId,
          repo: codingEnvironment.repository,
          taskType: "feature-implementation",
          promptStrategy: codingEnvironment.promptStrategy,
          deliveryPolicy: codingEnvironment.deliveryPolicy,
          shouldCommit: sandboxDeliveryPolicyCreatesCommit(codingEnvironment.deliveryPolicy),
          environmentSetup: codingEnvironment.environmentSetup,
          timeoutSeconds: codingEnvironment.timeoutSeconds,
          inspectionWindowSeconds: codingEnvironment.inspectionWindowSeconds,
        }
      : undefined,
  };
}
