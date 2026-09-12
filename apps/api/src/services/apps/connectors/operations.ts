import type { RecipeConnectorProvider } from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { listComposioConnectedAccounts } from "~/lib/providers/capabilities/connectors/composio/client";
import { requireActiveExecutionRun } from "~/services/chat-runs/execution-authority";
import { recordChatRunOperationalMetric } from "~/services/chat-runs/operational-metrics";
import { AssistantError, ErrorType } from "~/utils/errors";
import { isRecord } from "~/utils/objects";

import {
  getSelectedRecipeConnectorAccountId,
  selectActiveRecipeConnectorAccount,
} from "./accounts";
import { discoverComposioRunTools, executeComposioRunTool } from "./composio-run";
import { getRecipeConnectorAdapter } from "./connector-adapters";
import type { ConnectorRunScope } from "./connector-run-scope";
import { getRecipeConnectorAccessToken } from "./index";
import { normaliseConnectorOperationFailure } from "./operation-outcome";

export interface RecipeConnectorOperationRequest {
  provider: RecipeConnectorProvider;
  operation: string;
  params?: Record<string, unknown>;
  sessionId?: string;
  connectedAccountId?: string;
}

export async function getActiveComposioAccountForProvider(params: {
  context: ServiceContext;
  userId: number;
  provider: NonNullable<ReturnType<typeof getRecipeConnectorAdapter>>["provider"];
  connectedAccountId?: string;
  requireSelectedAccount?: boolean;
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
  const selectedAccountId = await getSelectedRecipeConnectorAccountId({
    context: params.context,
    userId: params.userId,
    providerId: params.provider.id,
  });
  const requestedAccountId = params.connectedAccountId ?? selectedAccountId;

  return selectActiveRecipeConnectorAccount({
    accounts,
    accountId: requestedAccountId,
    requireExact: Boolean(params.connectedAccountId) || params.requireSelectedAccount === true,
  });
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
  teammateContextId?: string;
  connectedAccountId?: string;
  requireSelectedAccount?: boolean;
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
    connectedAccountId: params.connectedAccountId,
    requireSelectedAccount: params.requireSelectedAccount,
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
      teammateContextId: params.teammateContextId,
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
          connectedAccountId: params.request.connectedAccountId,
        });

    try {
      await requireActiveExecutionRun(params.context);

      return await executeComposioRunTool({
        context: params.context,
        userId: params.userId,
        provider: adapter.provider,
        connectedAccount: account,
        operationId: operation.id,
        arguments: operationParams,
        sessionId: params.request.sessionId,
        scope: params.scope ?? { completionId: params.context.connectorRunId },
      });
    } catch (error) {
      const normalised = normaliseConnectorOperationFailure({
        provider: adapter.provider.name,
        operation,
        error,
      });

      if (normalised instanceof AssistantError && normalised.context?.outcome === "unknown") {
        recordChatRunOperationalMetric(params.context.env, {
          signal: "uncertain_tool_outcome",
          runId: params.context.executionRunId,
          attempt: params.context.executionRunAttempt,
          provider: adapter.provider.name,
          operation: operation.id,
          outcome: "unknown",
        });
      }

      throw normalised;
    }
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

  try {
    await requireActiveExecutionRun(params.context);

    return await adapter.executeOperation(
      token.accessToken,
      params.request.operation,
      operationParams,
    );
  } catch (error) {
    const normalised = normaliseConnectorOperationFailure({
      provider: adapter.provider.name,
      operation,
      error,
    });

    if (normalised instanceof AssistantError && normalised.context?.outcome === "unknown") {
      recordChatRunOperationalMetric(params.context.env, {
        signal: "uncertain_tool_outcome",
        runId: params.context.executionRunId,
        attempt: params.context.executionRunAttempt,
        provider: adapter.provider.name,
        operation: operation.id,
        outcome: "unknown",
      });
    }

    throw normalised;
  }
}
