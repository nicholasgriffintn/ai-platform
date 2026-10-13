import { getExecutableModelsForAccount, getModels } from "@ngriffin_uk/polychat-ai-models";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { filterModelsForUserAccess } from "~/modules/models/application/resolve";
import type { IUser } from "~/types";

export async function listAgentModelIds(context: ServiceContext, user: IUser): Promise<string[]> {
  const visible = await filterModelsForUserAccess(getModels(), context.env, user.id, {
    shouldUseCache: true,
    includePlatformModels: true,
  });

  return Object.entries(getExecutableModelsForAccount(visible, user))
    .filter(([, model]) => model.kind !== "agent" && model.runsOn !== "device")
    .map(([id]) => id);
}
