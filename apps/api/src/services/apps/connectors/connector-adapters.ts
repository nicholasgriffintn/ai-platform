import type { RecipeConnectorProvider } from "@assistant/schemas";

import {
	connectorProviders,
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

const connectorExecutors = {
	asana: executeAsanaOperation,
	calendar: executeCalendarOperation,
	cloudflare: executeCloudflareOperation,
	devin: executeDevinOperation,
	fitbit: executeFitbitOperation,
	gmail: executeGmailOperation,
	linear: executeLinearOperation,
	netlify: executeNetlifyOperation,
	notion: executeNotionOperation,
	oura: executeOuraOperation,
	outlook: executeOutlookOperation,
	posthog: executePostHogOperation,
	ramp: executeRampOperation,
	sentry: executeSentryOperation,
	supabase: executeSupabaseOperation,
	todoist: executeTodoistOperation,
	vercel: executeVercelOperation,
	webflow: executeWebflowOperation,
	withings: executeWithingsOperation,
} satisfies Partial<Record<RecipeConnectorProvider, ConnectorOperationExecutor>>;

const connectorAdapters = connectorProviders.map((provider) => ({
	provider,
	executeOperation: connectorExecutors[provider.id],
})) satisfies RecipeConnectorAdapter[];

export function getRecipeConnectorAdapters(): readonly RecipeConnectorAdapter[] {
	return connectorAdapters;
}

export function getRecipeConnectorAdapter(
	providerId: RecipeConnectorProvider,
): RecipeConnectorAdapter | undefined {
	return connectorAdapters.find((adapter) => adapter.provider.id === providerId);
}
