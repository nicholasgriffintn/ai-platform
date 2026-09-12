import type {
  RecipeConnectorProvider,
  TeammateRunConfiguration,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { getConnectorProviderConfig } from "~/lib/providers/capabilities/connectors";
import type { ProviderConnectionRecord } from "~/repositories/ProviderConnectionRepository";
import {
  CONNECTOR_ACCOUNT_REFERENCE_KIND,
  isConnectorConnectionKindForAuth,
} from "~/services/apps/connectors/connection-references";
import { AssistantError, ErrorType } from "~/utils/errors";

import { requireProjectTeammate } from "./access";

export interface TeammateConnectorAuthority {
  allowedOperations: string[];
  connection: ProviderConnectionRecord;
  connectedAccountId?: string;
  grantRevision: number;
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

  const teammateContext = await params.context.repositories.teammateContexts.getById(
    params.contextId,
  );

  if (
    !teammateContext ||
    teammateContext.actorUserId !== params.userId ||
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
  }

  const liveGrants = await params.context.repositories.teammateContexts.listConnectionGrants(
    teammateContext.id,
  );
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
                  admitted.allowedOperations.includes(operation),
                ),
              },
            ]
          : [];
      })
    : liveGrants;
  const resolved = await Promise.all(
    grants.map(async (grant) => ({
      grant,
      connection: await params.context.repositories.providerConnections.getConnectionById(
        grant.connectionId,
      ),
    })),
  );
  const matching: Array<{
    grant: (typeof grants)[number];
    connection: ProviderConnectionRecord;
  }> = [];

  for (const item of resolved) {
    if (
      item.connection?.user_id === params.userId &&
      item.connection.provider === params.provider &&
      item.connection.status === "connected" &&
      isConnectorConnectionKindForAuth(item.connection.kind, provider.auth.authType) &&
      (provider.auth.authType !== "composio" || Boolean(item.connection.external_id)) &&
      item.grant.allowedOperations.length > 0
    ) {
      matching.push({ grant: item.grant, connection: item.connection });
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
