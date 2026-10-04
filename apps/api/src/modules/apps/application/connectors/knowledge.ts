import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  RECIPE_CONNECTOR_CONNECTION_KIND,
  listComposioConnectedAccounts,
  type KnowledgeConnectorSession,
} from "@ngriffin_uk/polychat-ai-integrations";
import { authorise, ownsResource } from "@ngriffin_uk/polychat-library-policy";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { listRecipeConnectorAccounts } from "./accounts";
import { getRecipeConnectorProviderConfig } from "./connector-adapters";
import { readStoredToken } from "./index";

export function requireKnowledgeConnectorProvider(providerId: RecipeConnectorProvider) {
  const provider = getRecipeConnectorProviderConfig(providerId);

  if (!provider?.knowledge) {
    throw new AssistantError(
      "Connector does not support knowledge sync",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return { provider, adapter: provider.knowledge };
}

export async function selectKnowledgeConnectorConnection(
  context: ServiceContext,
  providerId: RecipeConnectorProvider,
  accountId?: string,
) {
  const { provider } = requireKnowledgeConnectorProvider(providerId);
  const user = context.requireUser();

  if (provider.auth.authType === "composio") {
    if (!accountId) {
      throw new AssistantError("Select a connected account", ErrorType.PARAMS_ERROR, 400);
    }

    await listRecipeConnectorAccounts({ context, userId: user.id, providerId });
  }

  const connection = await context.repositories.providerConnections.getConnection(
    user.id,
    providerId,
    provider.auth.authType === "composio"
      ? CONNECTOR_ACCOUNT_REFERENCE_KIND
      : RECIPE_CONNECTOR_CONNECTION_KIND,
    provider.auth.authType === "composio" ? accountId : undefined,
  );

  if (!connection) {
    throw new AssistantError("Connect this provider before syncing", ErrorType.PARAMS_ERROR, 400);
  }

  return connection;
}

export async function requireKnowledgeConnectorSession(
  context: ServiceContext,
  connectionId: string,
  providerId: RecipeConnectorProvider,
): Promise<KnowledgeConnectorSession> {
  const { provider, adapter } = requireKnowledgeConnectorProvider(providerId);
  const user = context.requireUser();
  const connection = await context.repositories.providerConnections.getConnectionById(connectionId);
  const connectionKind =
    provider.auth.authType === "composio"
      ? CONNECTOR_ACCOUNT_REFERENCE_KIND
      : RECIPE_CONNECTOR_CONNECTION_KIND;

  if (
    !connection ||
    !ownsResource(user.id, connection.user_id) ||
    connection.provider !== provider.id ||
    connection.kind !== connectionKind ||
    connection.status !== "connected"
  ) {
    throw new AssistantError("Connector connection is unavailable", ErrorType.FORBIDDEN, 403);
  }

  if (
    !authorise("connector.unattended", { supported: true, access: "read", destructive: false })
      .allowed
  ) {
    throw new AssistantError("Unattended indexing is not allowed", ErrorType.FORBIDDEN, 403);
  }

  if (provider.auth.authType === "composio") {
    const auth = provider.auth;
    const accounts = await listComposioConnectedAccounts({
      env: context.env,
      userId: user.id,
      toolkitSlugs: [auth.toolkitSlug],
      connectedAccountIds: [connection.external_id],
      authConfigIds: auth.authConfigs.map((config) => config.id),
    });
    const account = accounts.find(
      (candidate) =>
        candidate.id === connection.external_id &&
        candidate.toolkitSlug === auth.toolkitSlug &&
        auth.authConfigs.some((config) => config.id === candidate.authConfigId) &&
        candidate.status === "ACTIVE" &&
        !candidate.isDisabled,
    );

    if (!account) {
      throw new AssistantError("Connector account was revoked", ErrorType.FORBIDDEN, 403);
    }

    return {
      adapter,
      read: adapter.createReader({ type: "composio", env: context.env, accountId: account.id }),
    };
  }

  const stored = await readStoredToken(context, user.id, provider.id);

  if (!stored || stored.record.id !== connection.id || stored.record.status !== "connected") {
    throw new AssistantError("Connector credentials are unavailable", ErrorType.FORBIDDEN, 403);
  }

  return {
    adapter,
    read: adapter.createReader({ type: "api_key", token: stored.token.accessToken }),
  };
}
