import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  connectorOperationsForAccess,
  getConnectorProviderConfig,
  isConnectorConnectionKindForAuth,
} from "@ngriffin_uk/polychat-ai-integrations";
import { ownsResource, operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import type {
  RecipeConnectorProvider,
  TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { ProviderConnectionRepository } from "~/modules/connectors/infrastructure/ProviderConnectionRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";

import { requireProjectTeammate, requireWorkspaceTeammate } from "./access";

export interface TeammateConnectorAuthority {
  allowedOperations: string[];
  connection: ProviderConnectionRecord;
  connectedAccountId?: string;
  grantRevision: number;
}

async function inheritOwnerReadAuthority(params: {
  context: ServiceContext;
  userId: number;
  provider: NonNullable<ReturnType<typeof getConnectorProviderConfig>>;
}): Promise<TeammateConnectorAuthority | null> {
  const allowedOperations = connectorOperationsForAccess(params.provider, "read");

  if (allowedOperations.length === 0) {
    return null;
  }

  const connection = (
    await params.context.repositories
      .get(ProviderConnectionRepository)
      .listConnections(params.userId, params.provider.id)
  ).find(
    (candidate) =>
      candidate.status === "connected" &&
      isConnectorConnectionKindForAuth(candidate.kind, params.provider.auth.authType) &&
      (params.provider.auth.authType !== "composio" || Boolean(candidate.external_id)),
  );

  if (!connection) {
    return null;
  }

  return {
    allowedOperations,
    connection,
    grantRevision: 0,
    ...(connection.kind === CONNECTOR_ACCOUNT_REFERENCE_KIND && connection.external_id
      ? { connectedAccountId: connection.external_id }
      : {}),
  };
}

export async function resolveTeammateConnectorAuthority(params: {
  context: ServiceContext;
  contextId: string;
  userId: number;
  provider: RecipeConnectorProvider;
  admittedGrants?: TeammateRunConfiguration["connectionGrants"];
}): Promise<TeammateConnectorAuthority> {
  const provider = getConnectorProviderConfig(params.provider);

  if (!provider) {
    throw new AssistantError("Connector provider is unavailable", ErrorType.PARAMS_ERROR, 400);
  }

  const teammateContext = await params.context.repositories
    .get(TeammateContextRepository)
    .getById(params.contextId);

  if (
    !teammateContext ||
    !ownsResource(params.userId, teammateContext.actorUserId) ||
    teammateContext.status !== "active"
  ) {
    throw new AssistantError("Teammate context is unavailable", ErrorType.FORBIDDEN, 403);
  }

  if (teammateContext.scope.type === "project") {
    await requireProjectTeammate(
      params.context,
      teammateContext.scope.id,
      teammateContext.teammateId,
    );
  } else if (teammateContext.scope.type === "workspace") {
    await requireWorkspaceTeammate(
      params.context,
      teammateContext.scope.id,
      teammateContext.teammateId,
    );
  }

  const liveGrants = await params.context.repositories
    .get(TeammateContextRepository)
    .listConnectionGrants(teammateContext.id);
  const grants = params.admittedGrants
    ? liveGrants.flatMap((grant) => {
        const admitted = params.admittedGrants?.find(
          (candidate) =>
            candidate.id === grant.id &&
            candidate.connectionId === grant.connectionId &&
            candidate.revision === grant.revision,
        );

        return admitted
          ? [
              {
                ...grant,
                allowedOperations: grant.allowedOperations.filter((operation) =>
                  operationIsGranted(admitted.allowedOperations, operation),
                ),
              },
            ]
          : [];
      })
    : liveGrants;
  const resolved = await Promise.all(
    grants.map(async (grant) => ({
      grant,
      connection: await params.context.repositories
        .get(ProviderConnectionRepository)
        .getConnectionById(grant.connectionId),
    })),
  );
  const matching: Array<{
    grant: (typeof grants)[number];
    connection: ProviderConnectionRecord;
  }> = [];

  for (const item of resolved) {
    if (
      ownsResource(params.userId, item.connection?.user_id) &&
      item.connection.provider === params.provider &&
      item.connection.status === "connected" &&
      isConnectorConnectionKindForAuth(item.connection.kind, provider.auth.authType) &&
      (provider.auth.authType !== "composio" || Boolean(item.connection.external_id)) &&
      item.grant.allowedOperations.length > 0
    ) {
      matching.push({ grant: item.grant, connection: item.connection });
    }
  }

  if (matching.length === 0 && teammateContext.scope.type === "personal") {
    const inherited = await inheritOwnerReadAuthority({
      context: params.context,
      userId: params.userId,
      provider,
    });

    if (inherited) {
      return inherited;
    }
  }

  if (matching.length !== 1) {
    throw new AssistantError(
      matching.length === 0
        ? `This teammate has no ${params.provider} account grant`
        : `Choose one ${params.provider} account for this teammate context`,
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const [{ grant, connection }] = matching;

  return {
    allowedOperations: grant.allowedOperations,
    connection,
    grantRevision: grant.revision,
    ...(connection.kind === CONNECTOR_ACCOUNT_REFERENCE_KIND && connection.external_id
      ? { connectedAccountId: connection.external_id }
      : {}),
  };
}
