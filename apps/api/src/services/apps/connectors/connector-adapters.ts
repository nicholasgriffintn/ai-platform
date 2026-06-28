import type { RecipeConnectorProvider } from "@assistant/schemas";

import {
	getConnectorProviderConfig,
	type ConnectorProviderConfig,
} from "~/lib/providers/capabilities/connectors";
import { executeAsanaOperation } from "./executors/asana";
import { executeCalendarOperation } from "./executors/calendar";
import { executeCloudflareOperation } from "./executors/cloudflare";
import { executeDevinOperation } from "./executors/devin";
import { executeFitbitOperation } from "./executors/fitbit";
import { executeGmailOperation } from "./executors/gmail";
import { executeLinearOperation } from "./executors/linear";
import { executeNetlifyOperation } from "./executors/netlify";
import { executeNotionOperation } from "./executors/notion";
import { executeOuraOperation } from "./executors/oura";
import { executeOutlookOperation } from "./executors/outlook";
import { executePostHogOperation } from "./executors/posthog";
import { executeRampOperation } from "./executors/ramp";
import { executeSentryOperation } from "./executors/sentry";
import { executeSupabaseOperation } from "./executors/supabase";
import { executeTodoistOperation } from "./executors/todoist";
import { executeVercelOperation } from "./executors/vercel";
import { executeWebflowOperation } from "./executors/webflow";
import { executeWithingsOperation } from "./executors/withings";

export type ConnectorOperationExecutor = (
	token: string,
	operation: string,
	params: Record<string, unknown>,
) => Promise<unknown>;

export interface RecipeConnectorAdapter {
	provider: ConnectorProviderConfig;
	executeOperation?: ConnectorOperationExecutor;
}

function requireConnectorProviderConfig(
	providerId: RecipeConnectorProvider,
): ConnectorProviderConfig {
	const provider = getConnectorProviderConfig(providerId);
	if (!provider) {
		throw new Error(`Recipe connector provider is not registered: ${providerId}`);
	}

	return provider;
}

const connectorAdapters = [
	{
		provider: requireConnectorProviderConfig("cloudflare"),
		executeOperation: executeCloudflareOperation,
	},
	{
		provider: requireConnectorProviderConfig("devin"),
		executeOperation: executeDevinOperation,
	},
	{
		provider: requireConnectorProviderConfig("gmail"),
		executeOperation: executeGmailOperation,
	},
	{
		provider: requireConnectorProviderConfig("hindsight"),
	},
	{
		provider: requireConnectorProviderConfig("honcho"),
	},
	{
		provider: requireConnectorProviderConfig("calendar"),
		executeOperation: executeCalendarOperation,
	},
	{
		provider: requireConnectorProviderConfig("outlook"),
		executeOperation: executeOutlookOperation,
	},
	{
		provider: requireConnectorProviderConfig("linear"),
		executeOperation: executeLinearOperation,
	},
	{
		provider: requireConnectorProviderConfig("oura"),
		executeOperation: executeOuraOperation,
	},
	{
		provider: requireConnectorProviderConfig("fitbit"),
		executeOperation: executeFitbitOperation,
	},
	{
		provider: requireConnectorProviderConfig("webflow"),
		executeOperation: executeWebflowOperation,
	},
	{
		provider: requireConnectorProviderConfig("withings"),
		executeOperation: executeWithingsOperation,
	},
	{
		provider: requireConnectorProviderConfig("todoist"),
		executeOperation: executeTodoistOperation,
	},
	{
		provider: requireConnectorProviderConfig("asana"),
		executeOperation: executeAsanaOperation,
	},
	{
		provider: requireConnectorProviderConfig("sentry"),
		executeOperation: executeSentryOperation,
	},
	{
		provider: requireConnectorProviderConfig("posthog"),
		executeOperation: executePostHogOperation,
	},
	{
		provider: requireConnectorProviderConfig("ramp"),
		executeOperation: executeRampOperation,
	},
	{
		provider: requireConnectorProviderConfig("supabase"),
		executeOperation: executeSupabaseOperation,
	},
	{
		provider: requireConnectorProviderConfig("vercel"),
		executeOperation: executeVercelOperation,
	},
	{
		provider: requireConnectorProviderConfig("netlify"),
		executeOperation: executeNetlifyOperation,
	},
	{
		provider: requireConnectorProviderConfig("notion"),
		executeOperation: executeNotionOperation,
	},
	{
		provider: requireConnectorProviderConfig("github"),
	},
] satisfies RecipeConnectorAdapter[];

export function getRecipeConnectorAdapters(): readonly RecipeConnectorAdapter[] {
	return connectorAdapters;
}

export function getRecipeConnectorProviderConfigs(): readonly ConnectorProviderConfig[] {
	return connectorAdapters.map((adapter) => adapter.provider);
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
