import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import {
  connectorProviders,
  getConnectorProviderConfig,
  type ComposioAuthConfigDefinition,
  type ConnectorOperationAccess,
  type ConnectorOperationConfig,
  type ConnectorProviderConfig,
} from "./providers.js";

export const recipeConnectorOperationIds = Array.from(
  new Set(
    connectorProviders.flatMap((provider) => provider.operations.map((operation) => operation.id)),
  ),
);

export function getConnectorOperationConfig(
  providerId: RecipeConnectorProvider,
  operation: string,
): ConnectorOperationConfig | undefined {
  return getConnectorProviderConfig(providerId)?.operations.find((item) => item.id === operation);
}

export function isConnectorOperationSupported(
  providerId: RecipeConnectorProvider,
  operation: string,
): boolean {
  return Boolean(getConnectorOperationConfig(providerId, operation));
}

export function isConnectorOperationWrite(
  providerId: RecipeConnectorProvider,
  operation: string,
): boolean {
  return getConnectorOperationConfig(providerId, operation)?.access === "write";
}

export function connectorOperationRequiresApproval(
  providerId: RecipeConnectorProvider,
  operation: string,
): boolean {
  const config = getConnectorOperationConfig(providerId, operation);

  if (!config) {
    return true;
  }

  return config.access === "write" || config.destructive === true;
}

export function getConnectorProviderOperationAccess(
  provider: ConnectorProviderConfig,
): ConnectorOperationAccess | "mixed" {
  const accessLevels = new Set(provider.operations.map((operation) => operation.access));

  if (accessLevels.size === 0) {
    return "read";
  }

  if (accessLevels.size === 1) {
    return accessLevels.has("write") ? "write" : "read";
  }

  return "mixed";
}

export function isComposioOAuthAuthConfig(authConfig: ComposioAuthConfigDefinition): boolean {
  return ["OAUTH1", "OAUTH2", "DCR_OAUTH"].includes(authConfig.authScheme);
}
