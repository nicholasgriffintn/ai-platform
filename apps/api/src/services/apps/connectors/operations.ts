import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { isConnectorOperationSupported } from "~/lib/providers/capabilities/connectors";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { getRecipeConnectorAccessToken } from "./index";
import { executeAsanaOperation } from "./executors/asana";
import { executeCalendarOperation } from "./executors/calendar";
import { executeFitbitOperation } from "./executors/fitbit";
import { executeGmailOperation } from "./executors/gmail";
import { executeLinearOperation } from "./executors/linear";
import { executeNetlifyOperation } from "./executors/netlify";
import { executeNotionOperation } from "./executors/notion";
import { executeOuraOperation } from "./executors/oura";
import { executeOutlookOperation } from "./executors/outlook";
import { executePostHogOperation } from "./executors/posthog";
import { executeSentryOperation } from "./executors/sentry";
import { executeTodoistOperation } from "./executors/todoist";
import { executeVercelOperation } from "./executors/vercel";
import { executeWithingsOperation } from "./executors/withings";

export interface RecipeConnectorOperationRequest {
	provider: RecipeConnectorProvider;
	operation: string;
	params?: Record<string, unknown>;
}

type ConnectorOperationExecutor = (
	token: string,
	operation: string,
	params: Record<string, unknown>,
) => Promise<unknown>;

const oauthOperationExecutors = {
	asana: executeAsanaOperation,
	fitbit: executeFitbitOperation,
	gmail: executeGmailOperation,
	calendar: executeCalendarOperation,
	outlook: executeOutlookOperation,
	linear: executeLinearOperation,
	netlify: executeNetlifyOperation,
	notion: executeNotionOperation,
	oura: executeOuraOperation,
	posthog: executePostHogOperation,
	sentry: executeSentryOperation,
	todoist: executeTodoistOperation,
	vercel: executeVercelOperation,
	withings: executeWithingsOperation,
} satisfies Partial<Record<RecipeConnectorProvider, ConnectorOperationExecutor>>;

export async function executeRecipeConnectorOperation(params: {
	context: ServiceContext;
	userId: number;
	request: RecipeConnectorOperationRequest;
}) {
	const operationParams = params.request.params ?? {};
	if (!isRecord(operationParams)) {
		throw new AssistantError(
			"Connector operation params must be an object",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const executeOperation = oauthOperationExecutors[params.request.provider];
	if (!executeOperation) {
		throw new AssistantError(
			"GitHub recipe operations use the sandbox GitHub App tools",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	if (!isConnectorOperationSupported(params.request.provider, params.request.operation)) {
		throw new AssistantError("Unsupported recipe connector operation", ErrorType.PARAMS_ERROR, 400);
	}

	const token = await getRecipeConnectorAccessToken({
		context: params.context,
		userId: params.userId,
		provider: params.request.provider,
	});

	return executeOperation(token.accessToken, params.request.operation, operationParams);
}
