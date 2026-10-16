import { memoizeRequest } from "@ngriffin_uk/polychat-utility-server/request-cache";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IUserSettings } from "~/types";

export function getRequestUserSettings(
  context: Pick<ServiceContext, "user" | "repositories" | "requestCache">,
): Promise<IUserSettings | null> {
  const userId = context.user?.id;

  if (!userId) {
    return Promise.resolve(null);
  }

  return memoizeRequest(context.requestCache, `user-settings:${userId}`, () =>
    context.repositories.get(UserSettingsRepository).getUserSettings(userId),
  );
}
