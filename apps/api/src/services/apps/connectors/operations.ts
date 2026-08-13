import type { RecipeConnectorProvider } from "@assistant/schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";
import { getRecipeConnectorAdapter } from "./connector-adapters";
import { getRecipeConnectorAccessToken } from "./index";
import { listComposioConnectedAccounts } from "~/lib/providers/capabilities/connectors/composio/client";
import { discoverComposioRunTools, executeComposioRunTool } from "./composio-run";
import { getSelectedRecipeConnectorAccountId } from "./accounts";
import type { ConnectorRunScope } from "./connector-run-scope";

export interface RecipeConnectorOperationRequest {
	provider: RecipeConnectorProvider;
	operation: string;
	params?: Record<string, unknown>;
	sessionId?: string;
}

export async function getActiveComposioAccountForProvider(params: {
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
	const selectedAccountId = await getSelectedRecipeConnectorAccountId({
		context: params.context,
		userId: params.userId,
		providerId: params.provider.id,
	});
	const selectedAccount = activeAccounts.find((account) => account.id === selectedAccountId);
	if (selectedAccount) return selectedAccount;
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
	completionId: string;
	recipeId?: string;
	installationId?: string;
	projectId?: string;
}) {
	const adapter = getRecipeConnectorAdapter(params.provider);
	if (!adapter || adapter.provider.auth.authType !== "composio") {
		throw new AssistantError(
			"Dynamic tool discovery is available for Composio connectors",
			ErrorType.PARAMS_ERROR,
			400,
		);
	}
	const connectedAccount = await getActiveComposioAccountForProvider({
		context: params.context,
		userId: params.userId,
		provider: adapter.provider,
	});
	return discoverComposioRunTools({
		context: params.context,
		userId: params.userId,
		provider: adapter.provider,
		connectedAccount,
		allowedOperationIds: params.allowedOperations,
		useCase: params.useCase,
		scope: {
			completionId: params.completionId,
			recipeId: params.recipeId,
			installationId: params.installationId,
			projectId: params.projectId,
		},
	});
}

export async function executeRecipeConnectorOperation(params: {
	context: ServiceContext;
	userId: number;
	request: RecipeConnectorOperationRequest;
	scope?: ConnectorRunScope;
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
		const account = params.request.sessionId
			? undefined
			: await getActiveComposioAccountForProvider({
					context: params.context,
					userId: params.userId,
					provider: adapter.provider,
				});
		return executeComposioRunTool({
			context: params.context,
			userId: params.userId,
			provider: adapter.provider,
			connectedAccount: account,
			operationId: operation.id,
			arguments: operationParams,
			sessionId: params.request.sessionId,
			scope: params.scope ?? { completionId: params.context.connectorRunId },
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
