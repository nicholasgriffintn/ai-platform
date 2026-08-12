import type { RecipeConnectorProvider } from "@assistant/schemas";

import {
	connectorProviders,
	type ConnectorProviderConfig,
} from "~/lib/providers/capabilities/connectors";
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
}

const localExecutors: Partial<Record<RecipeConnectorProvider, ConnectorOperationExecutor>> = {
	devin: executeDevinOperation,
	netlify: executeNetlifyOperation,
};

const connectorAdapters: RecipeConnectorAdapter[] = connectorProviders.map((provider) => ({
	provider,
	...(localExecutors[provider.id] ? { executeOperation: localExecutors[provider.id] } : {}),
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
