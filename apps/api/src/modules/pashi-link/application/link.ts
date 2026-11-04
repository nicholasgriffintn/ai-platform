import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import type { PashiLinkSaveResult, PashiLinkStatus } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { storeProviderApiKey } from "~/modules/user/application/userOperations";
import { ApiKeyRepository } from "~/modules/user/infrastructure/ApiKeyRepository";
import { UserSettingsRepository } from "~/modules/user/infrastructure/UserSettingsRepository";
import type { IEnv, IUser } from "~/types";

const PASHI_LINK_PROVIDER = "pashi";

export async function readPashiLinkToken(env: IEnv, userId: number): Promise<string | null> {
  const settings = new UserSettingsRepository(env);

  return (await settings.hasProviderApiKey(userId, PASHI_LINK_PROVIDER))
    ? settings.getProviderApiKey(userId, PASHI_LINK_PROVIDER)
    : null;
}

export async function getPashiLinkStatus(
  context: ServiceContext,
  user: IUser,
): Promise<PashiLinkStatus> {
  return {
    linked: await context.repositories
      .get(UserSettingsRepository)
      .hasProviderApiKey(user.id, PASHI_LINK_PROVIDER),
    pro: hasProEntitlement(user),
  };
}

export async function savePashiLink(
  context: ServiceContext,
  user: IUser,
  token: string,
): Promise<PashiLinkSaveResult> {
  const replacedToken = await readPashiLinkToken(context.env, user.id);

  await storeProviderApiKey(context, PASHI_LINK_PROVIDER, token, undefined, undefined, user.id);

  return {
    ...(await getPashiLinkStatus(context, user)),
    ...(replacedToken && replacedToken !== token ? { replaced_token: replacedToken } : {}),
  };
}

export async function removePashiLink(
  context: ServiceContext,
  user: IUser,
  callingKey: string | undefined,
): Promise<void> {
  await context.repositories
    .get(UserSettingsRepository)
    .deleteProviderApiKey(user.id, PASHI_LINK_PROVIDER);

  if (callingKey) {
    await context.repositories.get(ApiKeyRepository).deleteApiKeyByValue(user.id, callingKey);
  }
}
