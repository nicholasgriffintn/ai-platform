import { getModels, resolveHostedAgentModel } from "@ngriffin_uk/polychat-ai-models";
import type { ModelTierRole, ReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { resolveProjectDefaultModelTier } from "~/modules/chat/application/policy/project-model-tier";
import { filterModelsForUserAccess } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

export interface HostedAgentModelResolution {
  model: string;
  effort?: ReasoningEffort;
}

export async function resolveHostedAgentRunModel(params: {
  context: ServiceContext;
  user: IUser;
  role: ModelTierRole;
  capability: string;
  projectId?: string;
}): Promise<HostedAgentModelResolution> {
  const visibleModels = await filterModelsForUserAccess(
    getModels(),
    params.context.env,
    params.user.id,
    { shouldUseCache: false },
  );
  const tier = await resolveProjectDefaultModelTier(params.context, params.projectId);
  const selected = resolveHostedAgentModel(visibleModels, params.user, tier, params.role);

  if (!selected) {
    throw new AssistantError(
      `No active ${params.capability.toLowerCase()} model is available for this account`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return {
    model: selected.id,
    ...(selected.effort ? { effort: selected.effort } : {}),
  };
}
