import { DEFAULT_MODEL_TIER, type ModelTier } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions } from "~/types";

export async function resolveProjectDefaultModelTier(
  context: ServiceContext,
  projectId: string | undefined,
): Promise<ModelTier> {
  if (!projectId) {
    return DEFAULT_MODEL_TIER;
  }

  const project = await context.repositories.workspaces.getProject(projectId);

  return project?.default_model_tier ?? DEFAULT_MODEL_TIER;
}

export async function resolveProjectModelTier(
  options: Pick<
    CoreChatOptions,
    "context" | "completion_id" | "metadata" | "model_tier" | "model" | "models"
  >,
): Promise<ModelTier> {
  if (options.model_tier) {
    return options.model_tier;
  }

  if (options.model || options.models?.length || !options.context) {
    return DEFAULT_MODEL_TIER;
  }

  const access = await resolveChatProjectAccess(options.context, options);

  return access?.project.default_model_tier ?? DEFAULT_MODEL_TIER;
}
