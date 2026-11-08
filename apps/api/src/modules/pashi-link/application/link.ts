import { hasProEntitlement } from "@ngriffin_uk/polychat-library-policy";
import type { PashiLinkSaveResult, PashiLinkStatus } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import {
  deleteRecipeConnectorConnection,
  readRecipeConnectorToken,
  storeRecipeConnectorAppLink,
} from "~/modules/connectors/application";
import type { IUser } from "~/types";

const PASHI_CONNECTOR = "pashi";

export const PASHI_MCP_LABEL = "Pashi";
export const PASHI_MCP_URL = "https://pashi.app/mcp";

export function readPashiLinkToken(context: ServiceContext, userId: number) {
  return readRecipeConnectorToken(context, userId, PASHI_CONNECTOR);
}

export async function getPashiLinkStatus(
  context: ServiceContext,
  user: IUser,
): Promise<PashiLinkStatus> {
  return {
    linked: (await readPashiLinkToken(context, user.id)) !== null,
    pro: hasProEntitlement(user),
  };
}

export async function savePashiLink(
  context: ServiceContext,
  user: IUser,
  token: string,
): Promise<PashiLinkSaveResult> {
  const replacedToken = await readPashiLinkToken(context, user.id);

  await storeRecipeConnectorAppLink({
    context,
    userId: user.id,
    provider: PASHI_CONNECTOR,
    token,
  });

  return {
    linked: true,
    pro: hasProEntitlement(user),
    ...(replacedToken && replacedToken !== token ? { replaced_token: replacedToken } : {}),
  };
}

export async function removePashiLink(context: ServiceContext, user: IUser): Promise<void> {
  await deleteRecipeConnectorConnection({
    context,
    userId: user.id,
    provider: PASHI_CONNECTOR,
  });
}
