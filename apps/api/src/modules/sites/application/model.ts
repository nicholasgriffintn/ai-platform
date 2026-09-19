import { getModels, resolveTierModel } from "@ngriffin_uk/polychat-ai-models";
import type { ModelTier, ReasoningEffort } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import {
  filterModelsForUserAccess,
  getLineupModelsForUser,
} from "~/modules/models/application/resolve";
import type { IEnv, IUser } from "~/types";

export interface SiteGenerationModel {
  model: string;
  provider: string;
  effort?: ReasoningEffort;
}

export async function resolveSiteGenerationModel({
  env,
  user,
  tier,
  requestedModel,
}: {
  env: IEnv;
  user: IUser;
  tier: ModelTier;
  requestedModel?: string;
}): Promise<SiteGenerationModel> {
  if (requestedModel) {
    const accessible = await filterModelsForUserAccess(getModels(), env, user.id);
    const selected = accessible[requestedModel];

    if (!selected) {
      throw new AssistantError("Selected model is not available", ErrorType.PARAMS_ERROR, 400);
    }

    return { model: selected.matchingModel, provider: selected.provider };
  }

  const lineup = await getLineupModelsForUser(env, user);
  const selected = resolveTierModel(lineup, user, tier, "coding");

  if (!selected) {
    throw new AssistantError(
      `No model in the ${tier} tier is available for this account`,
      ErrorType.CONFIGURATION_ERROR,
    );
  }

  return {
    model: selected.config.matchingModel,
    provider: selected.config.provider,
    effort: selected.effort,
  };
}
