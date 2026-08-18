import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import {
  connectorProviders,
  type ConnectorProviderConfig,
} from "~/lib/providers/capabilities/connectors";

import { resolveComposioApprovalAuthority } from "./composio-approval-authority";
import type { ResolveConnectorApprovalAuthority } from "./connector-approval-authority";
import { executeDevinOperation } from "./executors/devin";
import { executeNetlifyOperation } from "./executors/netlify";

export type ConnectorOperationExecutor = (
  token: string,
  operation: string,
  params: Record<string, unknown>,
) => Promise<unknown>;

export interface RecipeConnectorAdapter {
  provider: ConnectorProviderConfig;
  executeOperation?: ConnectorOperationExecutor;
  approval?: {
    mode: "stored-action";
    resolveAuthority: ResolveConnectorApprovalAuthority;
  };
}

const localExecutors: Partial<Record<RecipeConnectorProvider, ConnectorOperationExecutor>> = {
  devin: executeDevinOperation,
  netlify: executeNetlifyOperation,
};

const connectorAdapters: RecipeConnectorAdapter[] = connectorProviders.map((provider) => ({
  provider,
  ...(localExecutors[provider.id] ? { executeOperation: localExecutors[provider.id] } : {}),
  ...(provider.auth.authType === "composio"
    ? {
        approval: {
          mode: "stored-action" as const,
          resolveAuthority: resolveComposioApprovalAuthority,
        },
      }
    : {}),
}));

export function getRecipeConnectorAdapters(): readonly RecipeConnectorAdapter[] {
  return connectorAdapters;
}

export function getRecipeConnectorProviderConfigs(): readonly ConnectorProviderConfig[] {
  return connectorProviders;
}

export function getRecipeConnectorAdapter(
  providerId: RecipeConnectorProvider,
): RecipeConnectorAdapter | undefined {
  return connectorAdapters.find((adapter) => adapter.provider.id === providerId);
}

export function getRecipeConnectorProviderConfig(
  providerId: RecipeConnectorProvider,
): ConnectorProviderConfig | undefined {
  return getRecipeConnectorAdapter(providerId)?.provider;
}
