import {
  connectorOperationsForAccess,
  getConnectorProviderConfig,
  isAgentIdentityProvider,
} from "@ngriffin_uk/polychat-ai-integrations";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { listRecipeConnectorSummaries } from "./index";

export interface ConnectedConnector {
  id: RecipeConnectorProvider;
  name: string;
  agentIdentity: boolean;
}

export async function listConnectedConnectors(
  context: ServiceContext,
  userId: number,
): Promise<ConnectedConnector[]> {
  const connectors = await listRecipeConnectorSummaries({ context, userId, status: "connected" });

  return connectors.map((connector) => {
    const config = getConnectorProviderConfig(connector.id);

    return {
      id: connector.id,
      name: connector.name,
      agentIdentity: config ? isAgentIdentityProvider(config) : false,
    };
  });
}

export function providerOperationsForAccess(
  provider: RecipeConnectorProvider,
  access: "read" | "write",
): string[] {
  const config = getConnectorProviderConfig(provider);

  return config ? connectorOperationsForAccess(config, access) : [];
}
