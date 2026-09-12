import { recipeConnectorProviderSchema } from "@ngriffin_uk/polychat-schemas";

import { handleToolCalls } from "~/lib/chat/tools/execution";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationManager } from "~/lib/conversationManager";
import { isComposioConnectorSessionHandle } from "~/lib/providers/capabilities/connectors/composio/session-handle";
import type { ConnectorOperationApprovalRecord } from "~/repositories/ConnectorOperationApprovalRepository";
import type { IUser, Message } from "~/types";
import { abortableDelay } from "~/utils/abortable-delay";
import { canonicalJson } from "~/utils/canonical-json";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";
import { isRecord } from "~/utils/objects";

import { getRecipeConnectorAdapter } from "./connector-adapters";
import type { StoredConnectorOperationCall } from "./connector-approval-authority";
import { getConnectorArgumentDigest } from "./operation-approvals";

const TOOL_NAME = "use_recipe_connector";
const REPLAY_ERROR = "The stored connector action does not match the approved connector action";
const CONCURRENT_RESULT_POLL_INTERVAL_MS = 50;
const CONCURRENT_RESULT_TIMEOUT_MS = 1_000;

interface StoredToolCall {
  id: string;
  type: "function";
  function: {
    name: typeof TOOL_NAME;
    arguments: string;
  };
}

interface ReplayBoundary {
  call: StoredToolCall;
  callArguments: StoredConnectorOperationCall;
  pendingIndex: number;
  pendingMessageId: string;
  toolCallId: string;
}

export interface ApprovedConnectorReplay {
  summaryMessages: Message[];
  toolCall: StoredToolCall;
  toolResult: Message;
}

function failReplay(message = REPLAY_ERROR): never {
  throw new AssistantError(message, ErrorType.AUTHORISATION_ERROR, 403);
}

function failIndeterminate(): never {
  throw new AssistantError(
    "The approved connector action was consumed, but its result is not available yet",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

function parseExecutionResult(
  value: Record<string, unknown> | null,
  boundary: ReplayBoundary,
): Message | null {
  if (
    !value ||
    value.role !== "tool" ||
    value.name !== TOOL_NAME ||
    typeof value.id !== "string" ||
    typeof value.content !== "string" ||
    typeof value.status !== "string" ||
    value.tool_call_id !== boundary.toolCallId
  ) {
    return null;
  }

  return {
    role: "tool",
    name: TOOL_NAME,
    id: value.id,
    content: value.content,
    status: value.status,
    tool_call_id: boundary.toolCallId,
    ...(isRecord(value.data) ? { data: value.data } : {}),
    ...(typeof value.log_id === "string" ? { log_id: value.log_id } : {}),
    ...(typeof value.timestamp === "number" ? { timestamp: value.timestamp } : {}),
    ...(typeof value.model === "string" ? { model: value.model } : {}),
  };
}

function serialiseExecutionResult(message: Message): Record<string, unknown> {
  return Object.fromEntries(Object.entries(message));
}

function buildIndeterminateResult(boundary: ReplayBoundary, approvalId: string): Message {
  return {
    role: "tool",
    name: TOOL_NAME,
    id: `connector_result_${approvalId}`,
    content:
      "The connector action may have completed, but its outcome could not be confirmed. It was not retried. Check the connected service before taking another action.",
    status: "error",
    data: {
      approvalRequired: false,
      approvalId,
      outcome: "unknown",
      retryable: false,
    },
    tool_call_id: boundary.toolCallId,
    timestamp: Date.now(),
    platform: "api",
  };
}

async function projectExecutionResult(
  context: ServiceContext,
  completionId: string,
  result: Message,
): Promise<void> {
  if (!result.id || typeof result.content !== "string") {
    failReplay("The stored connector result is invalid");
  }

  await context.repositories.messages.createProjectedMessage(completionId, {
    id: result.id,
    role: result.role,
    content: result.content,
    data: result,
  });
}

function failCancelled(): never {
  throw new AssistantError(
    "Waiting for the approved connector result was cancelled",
    ErrorType.CONFLICT_ERROR,
    409,
  );
}

function parseStoredArguments(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = safeParseJson<unknown>(value);

  return isRecord(parsed) ? parsed : null;
}

function parseConnectorCallArguments(value: unknown): StoredConnectorOperationCall | null {
  const parsed = parseStoredArguments(value);

  if (!parsed) {
    return null;
  }

  const provider = recipeConnectorProviderSchema.safeParse(parsed.provider);
  const adapter = provider.success ? getRecipeConnectorAdapter(provider.data) : undefined;
  const sessionId = parsed.sessionId;

  if (
    !provider.success ||
    !adapter ||
    typeof parsed.operation !== "string" ||
    !parsed.operation.trim() ||
    (adapter.provider.auth.authType === "composio" &&
      !isComposioConnectorSessionHandle(sessionId)) ||
    (adapter.provider.auth.authType === "api_key" && sessionId !== undefined) ||
    (parsed.params !== undefined && !isRecord(parsed.params))
  ) {
    return null;
  }

  return {
    provider: provider.data,
    operation: parsed.operation,
    ...(typeof sessionId === "string" ? { sessionId } : {}),
    ...(isRecord(parsed.params) ? { params: parsed.params } : {}),
  };
}

function parseStoredToolCall(value: unknown, expectedId: string): StoredToolCall | null {
  if (!isRecord(value) || value.id !== expectedId || value.type !== "function") {
    return null;
  }

  const fn = value.function;

  if (
    !isRecord(fn) ||
    fn.name !== TOOL_NAME ||
    typeof fn.arguments !== "string" ||
    !parseConnectorCallArguments(fn.arguments)
  ) {
    return null;
  }

  return {
    id: expectedId,
    type: "function",
    function: { name: TOOL_NAME, arguments: fn.arguments },
  };
}

function findReplayBoundary(messages: Message[], approvalId: string): ReplayBoundary {
  let pendingIndex = -1;

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];

    if (
      message.role === "tool" &&
      message.name === TOOL_NAME &&
      message.status === "pending" &&
      message.data?.approvalRequired === true &&
      message.data?.approvalId === approvalId
    ) {
      pendingIndex = index;
      break;
    }
  }

  if (pendingIndex < 0) {
    failReplay("The approved connector action is missing from conversation history");
  }

  const pending = messages[pendingIndex];

  if (!pending.id || !pending.tool_call_id) {
    failReplay();
  }

  let call: StoredToolCall | null = null;

  for (let index = pendingIndex - 1; index >= 0; index--) {
    const candidate = messages[index];

    if (candidate.role !== "assistant" || !Array.isArray(candidate.tool_calls)) {
      continue;
    }

    for (const item of candidate.tool_calls) {
      call = parseStoredToolCall(item, pending.tool_call_id);
      if (call) {
        break;
      }
    }

    if (call) {
      break;
    }
  }

  if (!call) {
    failReplay();
  }

  const callArguments = parseConnectorCallArguments(call.function.arguments);

  if (!callArguments) {
    failReplay();
  }

  const pendingArguments = parseStoredArguments(pending.tool_call_arguments);

  if (pending.tool_call_arguments !== undefined && !pendingArguments) {
    failReplay();
  }

  if (pendingArguments && canonicalJson(pendingArguments) !== canonicalJson(callArguments)) {
    failReplay("The stored connector arguments disagree with the pending approval");
  }

  return {
    call,
    callArguments,
    pendingIndex,
    pendingMessageId: pending.id,
    toolCallId: pending.tool_call_id,
  };
}

function findTerminalResult(messages: Message[], boundary: ReplayBoundary): Message | undefined {
  return messages
    .slice(boundary.pendingIndex + 1)
    .find(
      (message) =>
        message.role === "tool" &&
        message.name === TOOL_NAME &&
        message.tool_call_id === boundary.toolCallId &&
        message.status !== "pending",
    );
}

async function waitForConcurrentResult(params: {
  boundary: ReplayBoundary;
  completionId: string;
  conversationManager: ConversationManager;
  signal?: AbortSignal;
  approvalId: string;
  context: ServiceContext;
  userId: number;
}): Promise<Message> {
  let elapsedMs = 0;

  while (elapsedMs <= CONCURRENT_RESULT_TIMEOUT_MS) {
    if (params.signal?.aborted) {
      failCancelled();
    }

    const messages = await params.conversationManager.getAllMessages(params.completionId, {
      includeArchived: false,
    });
    const result = findTerminalResult(messages, params.boundary);

    if (result) {
      return result;
    }

    const approval = await params.context.repositories.connectorOperationApprovals.getByIdForUser(
      params.approvalId,
      params.userId,
    );
    const journalled = approval
      ? parseExecutionResult(approval.executionResult, params.boundary)
      : null;

    if (journalled) {
      await projectExecutionResult(params.context, params.completionId, journalled);

      return journalled;
    }

    if (elapsedMs === CONCURRENT_RESULT_TIMEOUT_MS) {
      break;
    }

    const delayMs = Math.min(
      CONCURRENT_RESULT_POLL_INTERVAL_MS,
      CONCURRENT_RESULT_TIMEOUT_MS - elapsedMs,
    );

    try {
      await abortableDelay(delayMs, params.signal);
    } catch (error) {
      if (params.signal?.aborted) {
        failCancelled();
      }

      throw error;
    }

    elapsedMs += delayMs;
  }

  return failIndeterminate();
}

export async function replayApprovedConnectorOperation(params: {
  approval: ConnectorOperationApprovalRecord;
  context: ServiceContext;
  conversationManager: ConversationManager;
  user: IUser;
  model?: string;
  appUrl?: string;
  signal?: AbortSignal;
}): Promise<ApprovedConnectorReplay> {
  const { approval, context, conversationManager, user } = params;
  const parsedProvider = recipeConnectorProviderSchema.safeParse(approval.provider);
  const adapter = parsedProvider.success
    ? getRecipeConnectorAdapter(parsedProvider.data)
    : undefined;

  if (
    context.user?.id !== user.id ||
    approval.userId !== user.id ||
    !parsedProvider.success ||
    adapter?.approval?.mode !== "stored-action" ||
    !approval.operation ||
    !approval.runId ||
    !approval.completionId ||
    !approval.connectedAccountId ||
    (approval.state !== "approved" &&
      approval.state !== "rejected" &&
      approval.state !== "consumed") ||
    (approval.state === "approved" && approval.expiresAt <= new Date().toISOString())
  ) {
    failReplay();
  }

  const messages = await conversationManager.getAllMessages(approval.completionId, {
    includeArchived: false,
  });
  const boundary = findReplayBoundary(messages, approval.id);
  const run = await context.repositories.conversationRuns.getById(approval.runId);

  if (
    !run ||
    run.attempt !== approval.runAttempt ||
    run.status !== "awaiting_approval" ||
    run.interactionKind !== "approval" ||
    run.lastMessageId !== boundary.pendingMessageId ||
    boundary.callArguments.provider !== approval.provider ||
    boundary.callArguments.operation !== approval.operation
  ) {
    failReplay();
  }

  const storedResult = findTerminalResult(messages, boundary);

  if (approval.state === "rejected") {
    const toolResult =
      storedResult ??
      (await conversationManager.add(approval.completionId, {
        role: "tool",
        name: TOOL_NAME,
        content: "The user rejected this connector action.",
        status: "resolved",
        data: {
          approvalRequired: false,
          approvalId: approval.id,
          resolution: "rejected",
          humanInTheLoop: {
            type: "approval",
            status: "resolved",
            interactionId: boundary.toolCallId,
            toolName: TOOL_NAME,
            resolution: "rejected",
            requires_user_action: false,
          },
        },
        tool_call_id: boundary.toolCallId,
      }));

    return {
      toolCall: boundary.call,
      toolResult,
      summaryMessages: [...messages.slice(0, boundary.pendingIndex), toolResult],
    };
  }

  let authority;

  try {
    authority = await adapter.approval.resolveAuthority({
      approval,
      call: boundary.callArguments,
      context,
      userId: user.id,
    });
  } catch {
    failReplay();
  }

  const argumentDigest = await getConnectorArgumentDigest({
    provider: parsedProvider.data,
    operation: approval.operation,
    arguments: authority.arguments,
  });

  if (argumentDigest !== approval.argumentDigest) {
    failReplay();
  }

  if (approval.state === "consumed") {
    let terminalResult = storedResult ?? parseExecutionResult(approval.executionResult, boundary);

    if (!terminalResult && approval.executionState === "running") {
      const leaseActive =
        approval.executionLeaseExpiresAt !== null &&
        approval.executionLeaseExpiresAt > new Date().toISOString();

      if (leaseActive) {
        terminalResult = await waitForConcurrentResult({
          boundary,
          completionId: approval.completionId,
          conversationManager,
          signal: params.signal,
          approvalId: approval.id,
          context,
          userId: user.id,
        });
      }
    }

    if (!terminalResult) {
      const indeterminate = buildIndeterminateResult(boundary, approval.id);
      const recorded =
        await context.repositories.connectorOperationApprovals.recordIndeterminateExecution({
          id: approval.id,
          userId: user.id,
          observedAt: new Date().toISOString(),
          result: serialiseExecutionResult(indeterminate),
        });

      terminalResult =
        parseExecutionResult(recorded?.executionResult ?? null, boundary) ??
        (await waitForConcurrentResult({
          boundary,
          completionId: approval.completionId,
          conversationManager,
          signal: params.signal,
          approvalId: approval.id,
          context,
          userId: user.id,
        }));
    }

    if (!storedResult) {
      await projectExecutionResult(context, approval.completionId, terminalResult);
    }

    return {
      toolCall: boundary.call,
      toolResult: terminalResult,
      summaryMessages: [...messages.slice(0, boundary.pendingIndex), terminalResult],
    };
  }

  if (storedResult) {
    failReplay();
  }

  context.connectorRunId = approval.runId;
  const executionToken = generateId();

  context.connectorApprovalExecutionToken = executionToken;
  const mode = messages
    .slice(0, boundary.pendingIndex)
    .reverse()
    .find((message) => message.mode)?.mode;
  const toolResults = await handleToolCalls(
    approval.completionId,
    { response: "", tool_calls: [boundary.call] },
    conversationManager,
    {
      env: context.env,
      mode,
      request: {
        completion_id: approval.completionId,
        input: "",
        model: params.model,
        mode,
        date: new Date().toISOString().slice(0, 10),
        approved_tools: [TOOL_NAME],
        connector_approval_id: approval.id,
        tool_permissions_map: { [TOOL_NAME]: ["network", "read"] },
        options: authority.requestOptions,
        ...(authority.teammateContextId
          ? { teammate_context_id: authority.teammateContextId }
          : {}),
        ...(authority.projectId ? { metadata: { project_id: authority.projectId } } : {}),
      },
      app_url: params.appUrl,
      user,
      context,
    },
    { persistResults: "none", recoverUnknownToolCalls: false },
  );
  const toolResult = toolResults[0];

  if (
    toolResults.length !== 1 ||
    !toolResult ||
    toolResult.tool_call_id !== boundary.toolCallId ||
    toolResult.status === "pending"
  ) {
    failReplay("The approved connector action did not produce a stored result");
  }

  if (
    toolResult.status === "error" &&
    typeof toolResult.content === "string" &&
    toolResult.content.includes("already used, or does not match this action")
  ) {
    const refreshedApproval = await context.repositories.connectorOperationApprovals.getByIdForUser(
      approval.id,
      user.id,
    );

    if (refreshedApproval?.state === "consumed") {
      const winnerResult = await waitForConcurrentResult({
        boundary,
        completionId: approval.completionId,
        conversationManager,
        signal: params.signal,
        approvalId: approval.id,
        context,
        userId: user.id,
      });

      return {
        toolCall: boundary.call,
        toolResult: winnerResult,
        summaryMessages: [...messages.slice(0, boundary.pendingIndex), winnerResult],
      };
    }

    failIndeterminate();
  }

  const recorded = await context.repositories.connectorOperationApprovals.recordExecutionResult({
    id: approval.id,
    userId: user.id,
    executionToken,
    result: serialiseExecutionResult(toolResult),
  });

  if (!recorded) {
    failIndeterminate();
  }

  await projectExecutionResult(context, approval.completionId, toolResult);

  return {
    toolCall: boundary.call,
    toolResult,
    summaryMessages: [...messages.slice(0, boundary.pendingIndex), toolResult],
  };
}
