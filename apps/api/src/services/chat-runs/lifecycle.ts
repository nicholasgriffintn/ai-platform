import type {
  ChatContextSnapshot,
  ChatRetrySnapshot,
  ChatRun,
  ChatRunCommandReceipt,
  ChatRunStatus,
  RunProvenance,
} from "@ngriffin_uk/polychat-schemas";
import { TEAMMATE_RUN_RECONCILIATION_TASK_TYPE } from "@ngriffin_uk/polychat-schemas";

import type { AgentLoopExecutionResult } from "~/lib/chat/agent/agent-loop";
import type { ServiceContext } from "~/lib/context/serviceContext";
import type { ConversationRunRepository } from "~/repositories/ConversationRunRepository";
import { reconcileRecipeExecutionTask } from "~/services/apps/recipes/task-reconciliation";
import { isThreadLeaseOwnershipLostError } from "~/services/conversations/coordinator/client";
import { publishConversationChanged, publishRunChanged } from "~/services/sync/conversation-events";
import { withoutOrigin } from "~/services/sync/publish";
import { TaskExecutionOwnershipLostError } from "~/services/tasks/task-execution-lease";
import { TaskService } from "~/services/tasks/TaskService";
import {
  reconcileTeammateRun,
  teammateRunNeedsReconciliation,
} from "~/services/teammates/run-reconciliation";
import { resolveChatProjectAccess } from "~/services/workspaces/chatProjectAccess";
import type { CoreChatOptions } from "~/types";
import { canonicalJson } from "~/utils/canonical-json";
import { sha256Hex } from "~/utils/crypto";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { getLogger } from "~/utils/logger";

import { buildChatRunCommandPayload } from "./command-payload";
import { readToolInteractionId } from "./interactions";
import { recordChatRunOperationalMetric } from "./operational-metrics";

const logger = getLogger({ prefix: "services/chat-runs/lifecycle" });

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
        trigger: options.trigger,
        teammateContextId: options.teammate_context_id,
        computerId: options.computer_id,
        delegationId: options.delegation_id,
        resolvedConfiguration: runId ? undefined : options.resolved_configuration,
        toolPolicyMode: options.tool_policy_mode,
      },
      runId,
    }),
  );
}

function completionStatus(result: AgentLoopExecutionResult): ChatRunStatus {
  if (result.response.status === "pending") {
    if (!result.pendingInteractionKind) {
      throw new AssistantError(
        "A suspended run is missing its interaction kind",
        ErrorType.INTERNAL_ERROR,
      );
    }

    switch (result.pendingInteractionKind) {
      case "question":
        return "awaiting_input";
      case "takeover":
        return "awaiting_takeover";
      case "approval":
        return "awaiting_approval";
    }
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
  const childDelegation =
    await context.repositories.delegations.getByChildConversationId(conversationId);

  if (
    childDelegation &&
    (options.delegation_id !== childDelegation.id ||
      options.durable_execution?.kind !== "delegation")
  ) {
    throw new AssistantError(
      "Delegated conversations are read-only outside their delegated run",
      ErrorType.FORBIDDEN,
      403,
    );
  }

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
  const interactionId = readToolInteractionId(options.options);
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
    ...(options.trigger ? { trigger: options.trigger } : {}),
    ...(options.teammate_context_id ? { teammateContextId: options.teammate_context_id } : {}),
    ...(options.computer_id ? { computerId: options.computer_id } : {}),
    ...(options.delegation_id ? { delegationId: options.delegation_id } : {}),
    ...(options.resolved_configuration
      ? { resolvedConfiguration: options.resolved_configuration }
      : {}),
    ...(requestedRunId ? { runId: requestedRunId } : {}),
    ...(requestedRunId && interactionId ? { interactionId } : {}),
  };
}

export class ChatRunLifecycle {
  constructor(
    private readonly repository: Pick<
      ConversationRunRepository,
      "getById" | "updateContext" | "updateRetry" | "updateProvenance" | "transition"
    >,
    readonly receipt: ChatRunCommandReceipt,
    private readonly env?: CoreChatOptions["env"],
    private readonly serviceContext?: ServiceContext,
  ) {}

  get run(): ChatRun {
    return this.receipt.run;
  }

  private async announce(run: ChatRun): Promise<void> {
    const publisher = withoutOrigin(this.serviceContext ?? { env: this.env });

    await publishRunChanged(publisher, run);
    await publishConversationChanged(publisher, run.conversationId, { runId: run.id });
  }

  private async reconcile(result?: AgentLoopExecutionResult): Promise<void> {
    if (!this.serviceContext) {
      return;
    }

    try {
      await reconcileRecipeExecutionTask(this.serviceContext, this.run);
    } catch (error) {
      logger.warn("Recipe task reconciliation failed", {
        runId: this.run.id,
        attempt: this.run.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!teammateRunNeedsReconciliation(this.run)) {
      return;
    }

    try {
      await reconcileTeammateRun(this.serviceContext, this.run, result);
    } catch (error) {
      logger.warn("Immediate teammate run reconciliation failed", {
        runId: this.run.id,
        attempt: this.run.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    try {
      await new TaskService(
        this.serviceContext.env,
        this.serviceContext.repositories.tasks,
      ).enqueueTask({
        id: `teammate_run_reconciliation_${this.run.id}_${this.run.attempt}`,
        task_type: TEAMMATE_RUN_RECONCILIATION_TASK_TYPE,
        user_id: this.run.initiatorUserId,
        ...(this.run.projectId ? { project_id: this.run.projectId } : {}),
        priority: 4,
        task_data: { runId: this.run.id, attempt: this.run.attempt },
      });
    } catch (error) {
      logger.warn("Teammate run reconciliation remains pending", {
        runId: this.run.id,
        attempt: this.run.attempt,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

  async recordProvenance(provenance: RunProvenance): Promise<ChatRun> {
    const updated = await this.repository.updateProvenance(
      this.run.id,
      this.run.attempt,
      provenance,
    );

    if (!updated) {
      throw new AssistantError(
        "The run changed before its provenance could be recorded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    this.receipt.run = updated;

    return updated;
  }

  async complete(result: AgentLoopExecutionResult): Promise<ChatRun> {
    const status = completionStatus(result);
    const lastMessageId =
      result.finalMessage?.id ??
      result.memoryMessages.at(-1)?.id ??
      result.toolResponses.at(-1)?.id;
    let transitioned = await this.repository.transition({
      runId: this.run.id,
      attempt: this.run.attempt,
      status,
      interactionKind: result.pendingInteractionKind ?? null,
      ...(lastMessageId ? { lastMessageId } : {}),
      ...(status === "failed" ? { terminalReason: "Response failed safety checks" } : {}),
    });

    if (!transitioned) {
      const current = await this.repository.getById(this.run.id);

      if (current?.attempt === this.run.attempt) {
        if (current.status === "cancelled") {
          transitioned = current;
        } else if (current.status === "cancelling") {
          transitioned = await this.repository.transition({
            runId: current.id,
            attempt: current.attempt,
            status: "cancelled",
            terminalReason: "Run cancelled",
          });
        }
      }
    }

    if (!transitioned) {
      throw new AssistantError(
        "The run changed before completion could be recorded",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    this.receipt.run = transitioned;

    await this.announce(transitioned);
    await this.reconcile(result);

    if (transitioned.status === "cancelled" && transitioned.cancellationRequestedAt && this.env) {
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

      await this.announce(transitioned);
      await this.reconcile();

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
    ? new ChatRunLifecycle(
        scope.context.repositories.conversationRuns,
        receipt,
        scope.context.env,
        scope.context,
      )
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

  if (!receipt.duplicate) {
    const publisher = withoutOrigin(scope.context);

    await publishRunChanged(publisher, receipt.run);
    await publishConversationChanged(publisher, receipt.run.conversationId, {
      runId: receipt.run.id,
    });

    if (receipt.kind === "interaction_response" && teammateRunNeedsReconciliation(receipt.run)) {
      await reconcileTeammateRun(scope.context, receipt.run);
    }
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
    scope.context,
  );
}
