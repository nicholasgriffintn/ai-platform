import type {
  ChatContextSnapshot,
  ChatRetrySnapshot,
  ChatRun,
  ChatRunCommandReceipt,
  ChatRunStatus,
} from "@ngriffin_uk/polychat-schemas";

import type { AgentLoopExecutionResult } from "~/lib/chat/agent/agent-loop";
import type { ConversationRunRepository } from "~/repositories/ConversationRunRepository";
import { isThreadLeaseOwnershipLostError } from "~/services/conversations/coordinator/client";
import { TaskExecutionOwnershipLostError } from "~/services/tasks/task-execution-lease";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions } from "~/types";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { isRecord } from "~/utils/objects";

import { buildChatRunCommandPayload } from "./command-payload";
import { recordChatRunOperationalMetric } from "./operational-metrics";

function readInteractionId(options: CoreChatOptions): string | undefined {
  const response = options.options?.toolInteraction?.response;

  return isRecord(response) && typeof response.interactionId === "string"
    ? response.interactionId
    : undefined;
}

function readStageId(options: CoreChatOptions): string | null {
  return typeof options.command_payload?.stageId === "string"
    ? options.command_payload.stageId
    : null;
}

async function commandDigest(options: CoreChatOptions, runId?: string): Promise<string> {
  return sha256Hex(
    canonicalJson({
      input: options.command_payload ?? buildChatRunCommandPayload(options),
      internal: {
        conversationHistoryWriteMode: options.conversation_history_write_mode,
        conversationType: options.conversation_type,
        enforceModeToolPolicy: options.enforce_mode_tool_policy,
        persona: options.persona,
        requireApprovalFor: options.require_approval_for,
        toolPolicyMode: options.tool_policy_mode,
      },
      runId,
    }),
  );
}

function completionStatus(result: AgentLoopExecutionResult): ChatRunStatus {
  if (result.response.status === "pending") {
    return result.toolResponses.some((message) => message.name === "ask_user")
      ? "awaiting_input"
      : "awaiting_approval";
  }

  if (result.response.status === "stopped") {
    return "cancelled";
  }

  return result.guardrailsPassed ? "succeeded" : "failed";
}

async function authoriseRunScope(options: CoreChatOptions) {
  const context = options.context;
  const user = context?.user;
  const conversationId = options.completion_id;

  if (!context || !user?.id || !conversationId || options.store === false) {
    return null;
  }

  context.ensureDatabase();
  const conversation = await context.repositories.conversations.getConversation(conversationId);
  const projectAccess = await resolveChatProjectAccess(context, options);

  if (conversation && !conversation.project_id && conversation.user_id !== user.id) {
    throw new AssistantError(
      "You don't have permission to run this conversation",
      ErrorType.FORBIDDEN,
      403,
    );
  }

  const projectTask = await context.repositories.projectTasks.getTaskByConversation(conversationId);

  return {
    context,
    userId: user.id,
    conversationId,
    projectId: projectAccess?.project.id ?? null,
    projectTask,
  };
}

type AuthorisedRunScope = NonNullable<Awaited<ReturnType<typeof authoriseRunScope>>>;

async function buildRunCommand(
  scope: AuthorisedRunScope,
  options: CoreChatOptions,
  commandId: string,
) {
  const interactionId = readInteractionId(options);
  const interactionRun = interactionId
    ? await scope.context.repositories.conversationRuns.getForInteraction(
        scope.conversationId,
        interactionId,
      )
    : null;
  const requestedRunId = options.run_id ?? interactionRun?.id;

  return {
    commandId,
    conversationId: scope.conversationId,
    digest: await commandDigest(options, requestedRunId),
    kind: requestedRunId ? ("interaction_response" as const) : ("turn" as const),
    userId: scope.userId,
    projectId: scope.projectId,
    projectTaskId: scope.projectTask?.id ?? null,
    stageId: readStageId(options) ?? scope.projectTask?.stageId ?? null,
    ...(requestedRunId ? { runId: requestedRunId } : {}),
  };
}

export class ChatRunLifecycle {
  constructor(
    private readonly repository: ConversationRunRepository,
    readonly receipt: ChatRunCommandReceipt,
    private readonly env?: CoreChatOptions["env"],
  ) {}

  get run(): ChatRun {
    return this.receipt.run;
  }

  async isCancellationRequested(): Promise<boolean> {
    const current = await this.repository.getById(this.run.id);

    return (
      current?.attempt === this.run.attempt &&
      (current.status === "cancelling" || current.status === "cancelled")
    );
  }

  async recordContext(snapshot: ChatContextSnapshot): Promise<ChatRun> {
    if (
      snapshot.runId !== this.run.id ||
      snapshot.conversationId !== this.run.conversationId ||
      snapshot.attempt !== this.run.attempt
    ) {
      throw new AssistantError(
        "Context snapshot does not match the active run",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const updated = await this.repository.updateContext(this.run.id, this.run.attempt, snapshot);

    if (!updated) {
      throw new AssistantError(
        "The run changed before its context could be recorded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    this.receipt.run = updated;

    return updated;
  }

  async recordRetry(retry: ChatRetrySnapshot | null): Promise<ChatRun | null> {
    const updated = await this.repository.updateRetry(this.run.id, this.run.attempt, retry);

    if (!updated && retry) {
      throw new AssistantError(
        "The run changed before its retry could be recorded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    if (updated) {
      this.receipt.run = updated;
    }

    return updated;
  }

  async complete(result: AgentLoopExecutionResult): Promise<ChatRun> {
    const status = completionStatus(result);
    const lastMessageId =
      result.finalMessage?.id ??
      result.memoryMessages.at(-1)?.id ??
      result.toolResponses.at(-1)?.id;
    const transitioned = await this.repository.transition({
      runId: this.run.id,
      attempt: this.run.attempt,
      status,
      ...(lastMessageId ? { lastMessageId } : {}),
      ...(status === "failed" ? { terminalReason: "Response failed safety checks" } : {}),
    });

    if (!transitioned) {
      throw new AssistantError(
        "The run changed before completion could be recorded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    this.receipt.run = transitioned;

    if (status === "cancelled" && transitioned.cancellationRequestedAt && this.env) {
      recordChatRunOperationalMetric(this.env, {
        signal: "cancellation_latency",
        runId: transitioned.id,
        attempt: transitioned.attempt,
        outcome: "success",
        value: Math.max(
          0,
          Date.parse(transitioned.updatedAt) - Date.parse(transitioned.cancellationRequestedAt),
        ),
      });
    }

    return transitioned;
  }

  async fail(error: unknown): Promise<ChatRun | null> {
    const interrupted = isThreadLeaseOwnershipLostError(error);

    const transitioned = await this.repository.transition({
      runId: this.run.id,
      attempt: this.run.attempt,
      status: interrupted ? "interrupted" : "failed",
      terminalReason: error instanceof Error ? error.message : "Run failed",
    });

    if (transitioned) {
      this.receipt.run = transitioned;

      if (interrupted && this.env) {
        recordChatRunOperationalMetric(this.env, {
          signal: "ownership_loss",
          runId: transitioned.id,
          attempt: transitioned.attempt,
          outcome: "interrupted",
        });
      }
    }

    return transitioned;
  }
}

export async function findAcceptedChatRunCommand(
  options: CoreChatOptions,
): Promise<ChatRunLifecycle | null> {
  if (!options.command_id) {
    return null;
  }

  const scope = await authoriseRunScope(options);

  if (!scope) {
    return null;
  }

  const command = await buildRunCommand(scope, options, options.command_id);
  const receipt = await scope.context.repositories.conversationRuns.findCommandReceipt(command);

  if (receipt) {
    recordChatRunOperationalMetric(scope.context.env, {
      signal: "duplicate_command",
      runId: receipt.run.id,
      attempt: receipt.run.attempt,
      commandKind: receipt.kind,
      outcome: "success",
    });
  }

  return receipt
    ? new ChatRunLifecycle(scope.context.repositories.conversationRuns, receipt, scope.context.env)
    : null;
}

export async function acceptChatRun(options: CoreChatOptions): Promise<ChatRunLifecycle | null> {
  const scope = await authoriseRunScope(options);

  if (!scope) {
    return null;
  }

  const commandId = options.command_id ?? generateId();
  const receipt = await scope.context.repositories.conversationRuns.acceptCommand(
    await buildRunCommand(scope, options, commandId),
  );

  if (receipt.duplicate) {
    recordChatRunOperationalMetric(scope.context.env, {
      signal: "duplicate_command",
      runId: receipt.run.id,
      attempt: receipt.run.attempt,
      commandKind: receipt.kind,
      outcome: "success",
    });
  }

  if (!receipt.duplicate && receipt.run.status === "accepted") {
    const running = await scope.context.repositories.conversationRuns.transition({
      runId: receipt.run.id,
      attempt: receipt.run.attempt,
      status: "running",
    });

    if (!running) {
      throw new AssistantError("The accepted run could not start", ErrorType.CONFLICT_ERROR, 409);
    }

    receipt.run = running;
  }

  if (!receipt.duplicate && scope.projectTask && scope.projectTask.runId !== receipt.run.id) {
    const durableExecution = options.durable_execution;
    const updated = await scope.context.repositories.projectTasks.updateTask(
      scope.projectTask.id,
      { runId: receipt.run.id },
      durableExecution?.kind === "project_task"
        ? {
            dispatchTaskId: durableExecution.dispatchTaskId,
            ownerToken: durableExecution.executionOwnerToken,
          }
        : undefined,
    );

    if (!updated && durableExecution?.kind === "project_task") {
      throw new TaskExecutionOwnershipLostError();
    }
  }

  return new ChatRunLifecycle(
    scope.context.repositories.conversationRuns,
    receipt,
    scope.context.env,
  );
}
