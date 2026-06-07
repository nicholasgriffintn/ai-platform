import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { getRecipeConnectorAccessToken } from "./index";
import { executeCalendarOperation } from "./executors/calendar";
import { executeGmailOperation } from "./executors/gmail";
import { executeLinearOperation } from "./executors/linear";
import { executeNotionOperation } from "./executors/notion";
import { executeOuraOperation } from "./executors/oura";
import { executeOutlookOperation } from "./executors/outlook";

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
	gmail: executeGmailOperation,
	calendar: executeCalendarOperation,
	outlook: executeOutlookOperation,
	linear: executeLinearOperation,
	notion: executeNotionOperation,
	oura: executeOuraOperation,
} satisfies Partial<Record<RecipeConnectorProvider, ConnectorOperationExecutor>>;

export async function executeRecipeConnectorOperation(params: {
	context: ServiceContext;
	userId: number;
	request: RecipeConnectorOperationRequest;
}) {
	const operationParams = params.request.params ?? {};
	const executeOperation = oauthOperationExecutors[params.request.provider];
	if (!executeOperation) {
		throw new AssistantError(
			"GitHub recipe operations use the sandbox GitHub App tools",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}

	const token = await getRecipeConnectorAccessToken({
		context: params.context,
		userId: params.userId,
		provider: params.request.provider,
	});

	return executeOperation(token.accessToken, params.request.operation, operationParams);
}
