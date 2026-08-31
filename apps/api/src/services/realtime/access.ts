import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import { filterModelsForUserAccess, getModels } from "~/lib/providers/models";
import {
  getExecutableModelsForAccount,
  getModelCredentialAuthority,
} from "~/lib/providers/models/policy";
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
