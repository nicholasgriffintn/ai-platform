import {
  connectorOperationsForAccess,
  getConnectorProviderConfig,
} from "@ngriffin_uk/polychat-ai-integrations";
import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { listRecipeConnectorSummaries } from "./index";

export interface ConnectedConnector {
  id: RecipeConnectorProvider;
  name: string;
}

export async function listConnectedConnectors(
  context: ServiceContext,
  userId: number,
): Promise<ConnectedConnector[]> {
  const connectors = await listRecipeConnectorSummaries({ context, userId, status: "connected" });

  return connectors.map((connector) => ({ id: connector.id, name: connector.name }));
}

export function providerOperationsForAccess(
  provider: RecipeConnectorProvider,
  access: "read" | "write",
): string[] {
  const config = getConnectorProviderConfig(provider);

  return config ? connectorOperationsForAccess(config, access) : [];
}
