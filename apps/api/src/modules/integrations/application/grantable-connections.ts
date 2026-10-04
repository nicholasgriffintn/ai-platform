import {
  getConnectorProviderConfig,
  isConnectorConnectionKindForAuth,
} from "@ngriffin_uk/polychat-ai-integrations";
import { integrationIdSchema, type TeammateContextScope } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import type { ProviderConnectionRecord } from "~/modules/apps/infrastructure/ProviderConnectionRepository";

import { listDiscoverableNativeIntegrations } from "./catalogue";
import { MCP_CONNECTION_KIND } from "./connections";

export async function getTeammateGrantableConnection(
  context: ServiceContext,
  scope: TeammateContextScope,
  connection: ProviderConnectionRecord,
) {
  if (connection.status !== "connected") {
    return null;
  }

  const provider = getConnectorProviderConfig(connection.provider);

  if (
    provider &&
    isConnectorConnectionKindForAuth(connection.kind, provider.auth.authType) &&
    (provider.auth.authType !== "composio" || Boolean(connection.external_id))
  ) {
    return {
      id: connection.id,
      provider: provider.id,
      providerName: provider.name,
      accountId: connection.external_id || null,
      allowedOperations: provider.operations.map((operation) => operation.id),
    };
  }

  const integrationId = integrationIdSchema.safeParse(connection.provider);

  if (connection.kind !== MCP_CONNECTION_KIND || !integrationId.success) {
    return null;
  }

  const integrations = await listDiscoverableNativeIntegrations(
    context,
    scope.type === "project" ? scope.id : undefined,
  );
  const definition = integrations.find(
    (candidate) => candidate.id === integrationId.data && candidate.connected,
  );

  if (!definition) {
    return null;
  }

  return {
    id: connection.id,
    provider: definition.id,
    providerName: definition.name,
    accountId: null,
    allowedOperations: definition.snapshot.tools.map((tool) => tool.name),
  };
}
