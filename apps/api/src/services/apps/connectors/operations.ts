import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { getRecipeConnectorAdapter } from "./connector-adapters";
import { getRecipeConnectorAccessToken } from "./index";
import {
	createComposioToolSession,
	executeComposioSessionTool,
	listComposioConnectedAccounts,
	searchComposioSessionTools,
} from "~/lib/providers/capabilities/connectors/composio/client";

export interface RecipeConnectorOperationRequest {
	provider: RecipeConnectorProvider;
	operation: string;
	params?: Record<string, unknown>;
	sessionId?: string;
}

async function getActiveComposioAccount(params: {
	context: ServiceContext;
	userId: number;
	provider: NonNullable<ReturnType<typeof getRecipeConnectorAdapter>>["provider"];
}) {
	if (params.provider.auth.authType !== "composio") {
		throw new AssistantError("Connector is not managed by Composio", ErrorType.PARAMS_ERROR, 400);
	}
	const accounts = await listComposioConnectedAccounts({
		env: params.context.env,
		userId: params.userId,
		toolkitSlugs: [params.provider.auth.toolkitSlug],
		authConfigIds: params.provider.auth.authConfigs.map((config) => config.id),
	});
	const activeAccounts = accounts.filter((item) => item.status === "ACTIVE" && !item.isDisabled);
	if (activeAccounts.length === 0) {
		throw new AssistantError("Connector is not connected", ErrorType.AUTHORISATION_ERROR, 403);
	}
	return activeAccounts.reduce((selected, account) =>
		account.createdAt > selected.createdAt ? account : selected,
	);
}

export async function discoverRecipeConnectorTools(params: {
	context: ServiceContext;
	userId: number;
	provider: RecipeConnectorProvider;
	useCase: string;
	allowedOperations: string[];
}) {
	const adapter = getRecipeConnectorAdapter(params.provider);
	if (!adapter || adapter.provider.auth.authType !== "composio") {
		throw new AssistantError(
			"Dynamic tool discovery is available for Composio connectors",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const connectedAccount = await getActiveComposioAccount({
		context: params.context,
		userId: params.userId,
		provider: adapter.provider,
	});
	const sessionId = await createComposioToolSession({
		env: params.context.env,
		userId: params.userId,
		provider: adapter.provider,
		connectedAccount,
		allowedToolSlugs: params.allowedOperations,
	});
	return searchComposioSessionTools({
		env: params.context.env,
		sessionId,
		provider: adapter.provider,
		useCase: params.useCase,
	});
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
	if (!adapter) {
		throw new AssistantError("Unknown recipe connector provider", ErrorType.PARAMS_ERROR, 400);
	}
	const operation = adapter.provider.operations.find(
		(item) => item.id === params.request.operation,
	);
	if (!operation) {
		throw new AssistantError("Unsupported recipe connector operation", ErrorType.PARAMS_ERROR, 400);
	}
	if (adapter.provider.auth.authType === "composio") {
		const account = await getActiveComposioAccount({
			context: params.context,
			userId: params.userId,
			provider: adapter.provider,
		});
		const sessionId =
			params.request.sessionId ??
			(await createComposioToolSession({
				env: params.context.env,
				userId: params.userId,
				provider: adapter.provider,
				connectedAccount: account,
				allowedToolSlugs: [operation.id],
			}));
		return executeComposioSessionTool({
			env: params.context.env,
			userId: params.userId,
			sessionId,
			provider: adapter.provider,
			toolSlug: operation.id,
			arguments: operationParams,
		});
	}
	if (!adapter.executeOperation) {
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

	return adapter.executeOperation(token.accessToken, params.request.operation, operationParams);
}
