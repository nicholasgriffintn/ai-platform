import { hasPlanEntitlement } from "@ngriffin_uk/polychat-ai-billing";
import {
  getModels,
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
} from "@ngriffin_uk/polychat-ai-models";
import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { filterModelsForUserAccess } from "~/modules/models/application/resolve";
import type { CredentialAuthority, IEnv, IUser } from "~/types";

function matchesRequestedModel(
  requestedModel: string,
  modelId: string,
  model: {
    matchingModel?: string;
    name?: string;
  },
): boolean {
  return modelId === requestedModel || model.matchingModel === requestedModel;
}

export const REALTIME_ENTITLEMENT_MESSAGE =
  "Live sessions are a Pro feature. Upgrade to start one.";

export function lacksRealtimeEntitlement(user: IUser): boolean {
  return !hasPlanEntitlement(user.plan_id, "pro");
}

export async function getAccessibleRealtimeModel({
  env,
  user,
  model,
  provider,
}: {
  env: IEnv;
  user: IUser;
  model: string;
  provider: string;
}): Promise<
  { id: string; config: ModelConfigItem; credentialAuthority: CredentialAuthority } | undefined
> {
  const visibleModels = await filterModelsForUserAccess(getModels(), env, user.id, {
    shouldUseCache: false,
  });
  const accessibleModels = getExecutableModelsForAccount(visibleModels, user);

  const directMatch = accessibleModels[model];

  if (directMatch?.provider === provider) {
    return {
      id: model,
      config: directMatch,
      credentialAuthority: getModelCredentialAuthority(directMatch, user),
    };
  }

  const matchingEntries = Object.entries(accessibleModels).filter(
    ([modelId, config]) =>
      config.provider === provider && matchesRequestedModel(model, modelId, config),
  );

  if (matchingEntries.length !== 1) {
    return undefined;
  }

  const [id, config] = matchingEntries[0];

  return {
    id,
    config,
    credentialAuthority: getModelCredentialAuthority(config, user),
  };
}
