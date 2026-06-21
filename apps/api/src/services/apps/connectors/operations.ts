import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { getRecipeConnectorAdapter } from "./connector-adapters";
import { getRecipeConnectorAccessToken } from "./index";

export interface RecipeConnectorOperationRequest {
	provider: RecipeConnectorProvider;
	operation: string;
	params?: Record<string, unknown>;
}

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
	const adapter = getRecipeConnectorAdapter(params.request.provider);
	if (!adapter?.executeOperation) {
		throw new AssistantError(
			"GitHub recipe operations use the sandbox GitHub App tools",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	if (!adapter.provider.operations.some((operation) => operation.id === params.request.operation)) {
		throw new AssistantError("Unsupported recipe connector operation", ErrorType.PARAMS_ERROR, 400);
	}

	const token = await getRecipeConnectorAccessToken({
		context: params.context,
		userId: params.userId,
		provider: params.request.provider,
	});

	return adapter.executeOperation(token.accessToken, params.request.operation, operationParams);
}
