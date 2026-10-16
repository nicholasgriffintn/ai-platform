import type { ModelConfigItem } from "@ngriffin_uk/polychat-schemas";

import type { ModelLookup, ModelSource } from "~/modules/models/application/sources";

import { findPlatformChatModel, listPlatformChatModels } from "./chat-models";

async function findPlatformModel(
  modelId: string,
  { env, userId, provider }: ModelLookup,
): Promise<ModelConfigItem | null> {
  const platform = await findPlatformChatModel(modelId, env, userId);

  return platform && (!provider || platform.provider === provider) ? platform : null;
}

export const platformModelSource: ModelSource = {
  find: findPlatformModel,
  findByMatchingModel: findPlatformModel,
  list: listPlatformChatModels,
};
