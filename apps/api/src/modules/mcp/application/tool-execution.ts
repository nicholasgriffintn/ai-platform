import { McpProtocolClient, McpProtocolError } from "@ngriffin_uk/polychat-ai-integrations";
import { pendingApproval } from "@ngriffin_uk/polychat-library-interactions";
import { nativeMcpCallSchema, teammateRunConfigurationSchema } from "@ngriffin_uk/polychat-schemas";
import { canonicalJson } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";
import { createBoundedJsonSchemaValidator } from "@ngriffin_uk/polychat-utility-server/json";
import { redactSensitiveTokens } from "@ngriffin_uk/polychat-utility-server/redaction";

import { authoriseConnectorOperation } from "~/modules/apps/application/connectors/operation-approvals";
import { resolveRequestProjectId } from "~/modules/functions/application/request-context";
import type { ApiToolExecutionContext } from "~/types/functions";

import { readMcpCatalog } from "./access";
import { openMcpCredential } from "./credentials";
import { requireMcpCall, requireMcpScope } from "./scope";
import { createMcpRequestSender, requireMcpSnapshot } from "./transport";

export async function executeMcpTool(
  args: Record<string, unknown>,
  execution: ApiToolExecutionContext,
) {
  const request = execution.request;
  const context = request.context;

  if (!context || !request.user?.id || context.requireUser().id !== request.user.id) {
    throw new AssistantError("Sign in to use MCP tools", ErrorType.AUTHORISATION_ERROR, 403);
  }

  const run = await context.repositories.conversationRuns.getById(context.connectorRunId);
  const configuration = teammateRunConfigurationSchema.safeParse(run?.resolvedConfiguration);
  const scope = {
    projectId:
      request.memoryScope?.type === "project"
        ? request.memoryScope.projectId
        : (resolveRequestProjectId(request) ?? undefined),
    teammateContextId: request.request?.teammate_context_id,
    admittedServerIds: configuration.success
      ? configuration.data.mcpServers.map((server) => server.id)
      : undefined,
  };

  if (scope.teammateContextId && !configuration.success) {
    throw new AssistantError(
      "Start a new teammate run to use registered MCP servers",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const serverIds =
    scope.admittedServerIds ?? request.request?.tool_options?.native_mcp_server_ids ?? [];

  if (
    run &&
    ((run.projectId ?? undefined) !== scope.projectId ||
      (run.teammateContextId ?? undefined) !== scope.teammateContextId)
  ) {
    throw new AssistantError("MCP run scope changed", ErrorType.AUTHORISATION_ERROR, 403);
  }

  try {
    if (!args.operation) {
      const tools = [];

      for (const serverId of serverIds) {
        if (args.serverId && args.serverId !== serverId) {
          continue;
        }

        const { server } = await requireMcpScope(context, serverId, scope);

        tools.push({
          serverId,
          label: server.label,
          tools: readMcpCatalog(server).filter((tool) => tool.access !== "disabled"),
        });
      }

      return {
        status: "success",
        name: "mcp",
        content: "Selected MCP tools and their reviewed schemas",
        data: { servers: tools },
      };
    }

    const call = nativeMcpCallSchema.parse(args);

    if (!serverIds.includes(call.serverId)) {
      throw new AssistantError(
        "Select this MCP server before using its tools",
        ErrorType.AUTHORISATION_ERROR,
        403,
      );
    }

    const authority = await requireMcpCall(context, call, scope);
    const parsed = createBoundedJsonSchemaValidator(authority.tool.inputSchema).safeParse(
      call.params,
    );

    if (!parsed.success || canonicalJson(parsed.data) !== canonicalJson(call.params)) {
      throw new AssistantError(
        "MCP arguments do not match the reviewed tool schema",
        ErrorType.PARAMS_ERROR,
        400,
      );
    }

    if (authority.tool.access === "write") {
      const approval = await authoriseConnectorOperation({
        context,
        userId: request.user.id,
        provider: "mcp",
        operation: call.operation,
        arguments: call,
        connectedAccountId: authority.connection.id,
        authorityRevision: authority.connection.revision,
        channel: run?.trigger ?? "web",
        scope: { completionId: request.request?.completion_id ?? execution.completionId, ...scope },
        approvalId: request.request?.connector_approval_id,
      });

      if (!approval.approved) {
        return {
          status: "pending",
          name: "mcp",
          content: `Approve ${authority.server.label}: ${call.operation}`,
          data: {
            approvalRequired: true,
            approvalId: approval.approval?.id,
            provider: "mcp",
            operation: call.operation,
            argumentSummary: redactSensitiveTokens(call.params),
            expiresAt: approval.approval?.expiresAt,
            humanInTheLoop: pendingApproval({
              interactionId: execution.toolCallId,
              toolName: "mcp",
            }),
          },
        };
      }
    }

    const requireScope = async () => {
      await requireMcpCall(context, call, scope);
    };

    const credential = await openMcpCredential(context, authority.server, authority.connection);
    const client = new McpProtocolClient(
      createMcpRequestSender(context, authority.server, authority.connection, requireScope),
      execution.abortSignal ?? new AbortController().signal,
    );
    const result = await client.callTool(authority.tool, call.params);

    await requireMcpSnapshot(context, authority.server, authority.connection, requireScope);
    const safeResult = redactSensitiveTokens(
      result,
      credential.type === "none" ? undefined : credential.value,
    );

    return {
      status: result.isError ? "error" : "success",
      name: "mcp",
      content:
        safeResult.content
          .filter((item) => item.type === "text")
          .map((item) => item.text)
          .join("\n") || "MCP operation completed",
      data: safeResult,
    };
  } catch (error) {
    if (error instanceof AssistantError || error instanceof McpProtocolError) {
      return { status: "error", name: "mcp", content: error.message, data: { retryable: false } };
    }

    return {
      status: "error",
      name: "mcp",
      content: "MCP operation failed. Check the service before starting another action.",
      data: { retryable: false },
    };
  }
}
