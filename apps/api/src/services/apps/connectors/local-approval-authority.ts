import type { ServiceContext } from "~/lib/context/serviceContext";
import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import { resolveTeammateConnectorAuthority } from "~/services/teammates/connection-authority";

import { buildConnectorApprovalRecipeContext } from "./approval-recipe-context";
import { RECIPE_CONNECTOR_CONNECTION_KIND } from "./connection-references";
import {
  rejectConnectorApprovalAuthority,
  type ResolveConnectorApprovalAuthority,
  type StoredConnectorOperationCall,
} from "./connector-approval-authority";

async function requireLocalConnection(params: {
  context: ServiceContext;
  userId: number;
  provider: string;
  connectionId: string;
}) {
  const connection = await params.context.repositories.providerConnections.getConnectionById(
    params.connectionId,
  );

  if (
    !connection ||
    connection.user_id !== params.userId ||
    connection.provider !== params.provider ||
    connection.kind !== RECIPE_CONNECTOR_CONNECTION_KIND ||
    connection.status !== "connected"
  ) {
    rejectConnectorApprovalAuthority();
  }

  return connection;
}

function mergeStoredArguments(
  call: StoredConnectorOperationCall,
  configuration: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...configuration, ...call.params };
}

export const resolveLocalApprovalAuthority: ResolveConnectorApprovalAuthority = async (params) => {
  const provider = getConnectorProviderConfig(params.approval.provider);

  if (!provider || provider.auth.authType !== "api_key" || params.call.sessionId) {
    rejectConnectorApprovalAuthority();
  }

  const connection = await requireLocalConnection({
    context: params.context,
    userId: params.userId,
    provider: params.approval.provider,
    connectionId: params.approval.connectedAccountId,
  });

  if (params.approval.teammateContextId) {
    const authority = await resolveTeammateConnectorAuthority({
      context: params.context,
      contextId: params.approval.teammateContextId,
      userId: params.userId,
      provider: provider.id,
    });

    if (
      authority.connection.id !== connection.id ||
      authority.grantRevision !== params.approval.authorityRevision ||
      !authority.allowedOperations.includes(params.approval.operation)
    ) {
      rejectConnectorApprovalAuthority();
    }
  } else if (params.approval.authorityRevision !== 0) {
    rejectConnectorApprovalAuthority();
  }

  const recipeContext = await buildConnectorApprovalRecipeContext({
    context: params.context,
    userId: params.userId,
    channel: params.approval.channel,
    recipeId: params.approval.recipeId,
    installationId: params.approval.installationId,
    projectId: params.approval.projectId,
    teammateContextId: params.approval.teammateContextId,
  });

  return {
    ...recipeContext,
    arguments: mergeStoredArguments(
      params.call,
      recipeContext.requestOptions.recipe?.configuration,
    ),
  };
};
