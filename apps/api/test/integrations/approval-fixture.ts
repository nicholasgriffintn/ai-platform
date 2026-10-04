import type { D1Database } from "@cloudflare/workers-types";
import { createIntegrationSnapshot } from "@ngriffin_uk/polychat-ai-integrations";
import { chatRunSchema, NATIVE_MCP_TOOL_NAME } from "@ngriffin_uk/polychat-schemas";
import { vi } from "vitest";

import { createServiceContext } from "~/infrastructure/context/serviceContext";
import { getConnectorArgumentDigest } from "~/modules/apps/application/connectors/operation-approvals";
import type { ConnectorOperationApprovalRecord } from "~/modules/apps/infrastructure/ConnectorOperationApprovalRepository";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { storeIntegrationConnection } from "~/modules/integrations/application/connections";
import { requireIntegrationExecutionAuthority } from "~/modules/integrations/application/execution-authority";
import { ToolCallType, type Message, type ToolCall } from "~/types";

import { databaseTestEnvironment } from "../environment";
import { integrationTestUser } from "./database";

export async function createNativeApprovalFixture(database: D1Database) {
  const environment = databaseTestEnvironment(database);

  environment.JWT_SECRET = "integration-replay-test-key";
  const user = integrationTestUser(1);
  const context = createServiceContext({ env: environment, user });
  const snapshot = await createIntegrationSnapshot({
    endpoint: "https://tools.example.com/mcp",
    authentication: "bearer",
    tools: [
      {
        name: "publish_report",
        inputSchema: {
          type: "object",
          properties: { report: { type: "string" } },
          required: ["report"],
        },
      },
    ],
  });
  const definition = await context.repositories.integrationDefinitions.create({
    userId: 1,
    name: "Service",
    description: "",
    snapshot,
  });

  await storeIntegrationConnection({
    context,
    userId: 1,
    definitionId: definition.id,
    snapshot,
    token: "native-replay-test-token",
  });
  const authority = await requireIntegrationExecutionAuthority({
    context,
    userId: 1,
    definitionId: definition.id,
  });
  const argumentsValue = { report: "Reviewed report" };
  const argumentDigest = await getConnectorArgumentDigest({
    provider: definition.id,
    operation: "publish_report",
    arguments: argumentsValue,
  });
  const approval: ConnectorOperationApprovalRecord = {
    id: "coa_native_approved",
    userId: 1,
    runId: "run-native",
    runAttempt: 1,
    completionId: "chat-native",
    provider: definition.id,
    operation: "publish_report",
    connectedAccountId: authority.connectedAccountId,
    channel: "web",
    argumentDigest,
    arguments: argumentsValue,
    authorityRevision: 0,
    state: "approved",
    createdAt: "2026-10-04T20:00:00.000Z",
    expiresAt: "2099-10-04T20:10:00.000Z",
    resolvedAt: "2026-10-04T20:01:00.000Z",
    consumedAt: null,
    executionState: null,
    executionToken: null,
    executionLeaseExpiresAt: null,
    executionResult: null,
  };
  const call: ToolCall = {
    id: "native-call",
    type: ToolCallType.FUNCTION,
    function: {
      name: NATIVE_MCP_TOOL_NAME,
      arguments: JSON.stringify({
        provider: definition.id,
        operation: "publish_report",
        params: argumentsValue,
      }),
    },
  };
  const pending: Message = {
    id: "native-pending",
    role: "tool",
    name: NATIVE_MCP_TOOL_NAME,
    tool_call_id: call.id,
    tool_call_arguments: call.function.arguments,
    status: "pending",
    content: "Approval required",
    data: { approvalRequired: true, approvalId: approval.id },
  };
  const messages: Message[] = [
    { role: "user", content: "Publish the report" },
    { role: "assistant", content: "", tool_calls: [call], mode: "agent" },
    pending,
  ];
  const terminal: Message = {
    id: "native-result",
    role: "tool",
    name: NATIVE_MCP_TOOL_NAME,
    tool_call_id: call.id,
    status: "success",
    content: "Report published",
    data: { reportId: "report-1" },
  };
  const manager = ConversationManager.getInstance({
    database: context.database,
    user,
    env: environment,
  });
  const getMessages = vi.spyOn(manager, "getAllMessages").mockResolvedValue(messages);

  vi.spyOn(context.repositories.conversationRuns, "getById").mockResolvedValue(
    chatRunSchema.parse({
      protocolVersion: 1,
      id: approval.runId,
      conversationId: approval.completionId,
      projectId: null,
      projectTaskId: null,
      initiatorUserId: 1,
      status: "awaiting_approval",
      interactionKind: "approval",
      attempt: 1,
      createdAt: approval.createdAt,
      updatedAt: approval.createdAt,
      startedAt: null,
      completedAt: null,
      terminalReason: null,
      lastMessageId: pending.id,
    }),
  );
  const getApproval = vi
    .spyOn(context.repositories.connectorOperationApprovals, "getByIdForUser")
    .mockResolvedValue(approval);
  const recordResult = vi
    .spyOn(context.repositories.connectorOperationApprovals, "recordExecutionResult")
    .mockImplementation(async ({ result, executionToken }) => ({
      ...approval,
      state: "consumed",
      executionState: "completed",
      executionToken,
      executionResult: result,
    }));
  const recordIndeterminate = vi
    .spyOn(context.repositories.connectorOperationApprovals, "recordIndeterminateExecution")
    .mockImplementation(async ({ result }) => ({
      ...approval,
      state: "consumed",
      executionState: "indeterminate",
      executionResult: result,
    }));
  const projectResult = vi
    .spyOn(context.repositories.messages, "createProjectedMessage")
    .mockResolvedValue(undefined);

  return {
    approval,
    context,
    definition,
    snapshot,
    user,
    call,
    pending,
    terminal,
    messages,
    manager,
    getMessages,
    getApproval,
    recordResult,
    recordIndeterminate,
    projectResult,
  };
}
