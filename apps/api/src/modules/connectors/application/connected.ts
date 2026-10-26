import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";

import { getRecipeConnectorProviderConfigs } from "./connector-adapters";
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

export function connectorOperationsForAccess(
  provider: RecipeConnectorProvider,
  access: "read" | "write",
): string[] {
  const config = getRecipeConnectorProviderConfigs().find((candidate) => candidate.id === provider);

  return (config?.operations ?? [])
    .filter((operation) =>
      access === "read" ? operation.access === "read" : operation.destructive !== true,
    )
    .map((operation) => operation.id);
}
