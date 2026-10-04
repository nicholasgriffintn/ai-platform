import {
  executeNativeMcpOperation,
  getGrantedIntegrationTools,
  NativeMcpError,
  validateNativeMcpArguments,
} from "@ngriffin_uk/polychat-ai-integrations";
import { pendingApproval } from "@ngriffin_uk/polychat-library-interactions";
import { operationIsGranted } from "@ngriffin_uk/polychat-library-policy";
import {
  integrationDiscoverySchema,
  NATIVE_MCP_TOOL_NAME,
  teammateRunConfigurationSchema,
  type IntegrationDiscovery,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { authoriseConnectorOperation } from "~/modules/apps/application/connectors/operation-approvals";
import {
  getActiveRecipeSetup,
  getRecipeExecutionChannel,
} from "~/modules/apps/application/recipes/toolContext";
import { resolveRequestProjectId } from "~/modules/functions/application/request-context";
import type { IFunctionResponse } from "~/types";
import type { ApiToolExecutionContext } from "~/types/functions";

import { requireIntegrationExecutionAuthority } from "./execution-authority";

export async function runNativeIntegrationGateway(
  input: IntegrationDiscovery,
  execution: ApiToolExecutionContext,
): Promise<IFunctionResponse> {
  const args = integrationDiscoverySchema.parse(input);
  const { request } = execution;

  if (!request.user || !request.context) {
    throw new AssistantError(
      "Sign in to use custom integrations",
      ErrorType.AUTHENTICATION_ERROR,
      401,
    );
  }

  if (
    getActiveRecipeSetup(request.request?.options) ||
    (getRecipeExecutionChannel(request.request?.options) ?? "web") !== "web"
  ) {
    throw new AssistantError(
      "Custom integrations require an interactive conversation and explicit action approval",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const configuration = teammateRunConfigurationSchema.safeParse(
    request.request?.resolved_configuration,
  );

  if (
    request.request?.teammate_context_id &&
    request.request.resolved_configuration !== undefined &&
    !configuration.success
  ) {
    throw new AssistantError(
      "The admitted teammate configuration is invalid",
      ErrorType.AUTHORISATION_ERROR,
      403,
    );
  }

  const authorityInput = {
    context: request.context,
    userId: request.user.id,
    definitionId: args.provider,
    projectId: resolveRequestProjectId(request) ?? undefined,
    teammateContextId: request.request?.teammate_context_id,
    ...(configuration.success ? { admittedGrants: configuration.data.connectionGrants } : {}),
  };

  try {
    const authority = await requireIntegrationExecutionAuthority(authorityInput);

    if (!args.operation) {
      return {
        status: "success",
        name: NATIVE_MCP_TOOL_NAME,
        content:
          "These are the exact reviewed actions available in this conversation. Every action requires approval.",
        data: {
          provider: args.provider,
          revision: authority.definition.revision,
          tools: getGrantedIntegrationTools(authority.definition.snapshot, authority.operations),
          approvalRequiredForActions: true,
        },
      };
    }

    if (!operationIsGranted(authority.operations, args.operation)) {
      throw new AssistantError(
        "This action is not granted in the current scope",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const tool = authority.definition.snapshot.tools.find(
      (candidate) => candidate.name === args.operation,
    );

    if (!tool) {
      throw new AssistantError(
        "The reviewed action is unavailable",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    validateNativeMcpArguments(tool, args.params);
    const approvalInput = {
      context: request.context,
      userId: request.user.id,
      provider: args.provider,
      operation: args.operation,
      arguments: args.params,
      connectedAccountId: authority.connectedAccountId,
      authorityRevision: authority.authorityRevision,
      channel: "web",
      scope: {
        completionId: execution.completionId,
        projectId: authorityInput.projectId,
        teammateContextId: authorityInput.teammateContextId,
      },
    };
    const approvalId = request.request?.connector_approval_id;

    if (!approvalId) {
      const decision = await authoriseConnectorOperation(approvalInput);

      return {
        status: "pending",
        name: NATIVE_MCP_TOOL_NAME,
        content: `Approval is required before ${authority.definition.name} can run ${args.operation}.`,
        data: {
          approvalRequired: true,
          approvalId: decision.approval?.id,
          provider: args.provider,
          operation: args.operation,
          argumentSummary: redactSensitiveTokens(args.params),
          expiresAt: decision.approval?.expiresAt,
          humanInTheLoop: pendingApproval({
            interactionId: execution.toolCallId,
            toolName: NATIVE_MCP_TOOL_NAME,
          }),
        },
      };
    }

    const result = await executeNativeMcpOperation({
      snapshot: authority.definition.snapshot,
      token: authority.connection.token,
      operation: args.operation,
      params: args.params,
      beforeExecute: async () => {
        const current = await requireIntegrationExecutionAuthority(authorityInput);

        if (
          current.connectedAccountId !== authority.connectedAccountId ||
          current.authorityRevision !== authority.authorityRevision ||
          !operationIsGranted(current.operations, args.operation ?? "")
        ) {
          throw new AssistantError(
            "Integration authority changed before execution; request a new approval",
            ErrorType.AUTHORISATION_ERROR,
            403,
          );
        }

        await authoriseConnectorOperation({
          ...approvalInput,
          connectedAccountId: current.connectedAccountId,
          authorityRevision: current.authorityRevision,
          approvalId,
        });
      },
    });

    return {
      status: result.isError ? "error" : "success",
      name: NATIVE_MCP_TOOL_NAME,
      content: result.isError
        ? "The service reported an action error. Check its result before trying again."
        : "Integration action completed",
      data: { provider: args.provider, operation: args.operation, result, retryable: false },
    };
  } catch (error) {
    if (error instanceof NativeMcpError || error instanceof AssistantError) {
      const unknown = error instanceof NativeMcpError && error.code === "UNKNOWN_OUTCOME";

      return {
        status: "error",
        name: NATIVE_MCP_TOOL_NAME,
        content: error.message,
        data: {
          provider: args.provider,
          operation: args.operation,
          errorCode: error instanceof NativeMcpError ? error.code : error.type,
          retryable: false,
          ...(unknown ? { outcome: "unknown", requiresUserAction: true } : {}),
        },
      };
    }

    throw error;
  }
}
