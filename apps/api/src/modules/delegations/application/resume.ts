import { getLogger } from "@ngriffin_uk/polychat-ai-telemetry";
import {
  DELEGATION_RUN_TASK_TYPE,
  MAX_DELEGATION_RUN_RESUMES,
  delegationRunTaskDataSchema,
  type ChatRun,
  type Delegation,
  type DelegationRunResume,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { getErrorMessage } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { hydrateChatRunUsage } from "~/modules/chat-runs/application/usage";
import { resolveToolCallEffectClass } from "~/modules/chat/application/tools/effects";
import { ConversationManager } from "~/modules/conversations/application/manager";
import { withThreadLockIfFree } from "~/modules/conversations/infrastructure/coordinator/client";
import { delegationRunTaskId } from "~/modules/delegations/application/run-identity";
import {
  findUnsettledToolCalls,
  settleInterruptedCall,
} from "~/modules/delegations/domain/interrupted-calls";
import { functionToolDescriptors } from "~/modules/functions/application/definitions";
import { TaskService } from "~/modules/tasks/application/TaskService";
import type { IUser, Message } from "~/types";

const logger = getLogger({ prefix: "services/delegations/resume" });

export function buildDelegationResumeInstruction(
  goal: string,
  resume: DelegationRunResume,
): string {
  const unknown =
    resume.unknownOutcomes.length > 0
      ? ` These calls may or may not have taken effect: ${resume.unknownOutcomes.join(", ")}. Check before repeating any of them.`
      : "";

  return `Your previous run on this task was interrupted before it finished. Continue from where it stopped instead of starting again.${unknown}\n\nThe task was:\n${goal}`;
}

function readTimestamp(row: Record<string, unknown> | undefined): number | null {
  return typeof row?.timestamp === "number" ? row.timestamp : null;
}

async function settleUnsettledToolCalls(
  context: ServiceContext,
  user: IUser,
  run: ChatRun,
): Promise<string[] | null> {
  const rows = await context.repositories.messages.getRunMessages(run.conversationId, run.id);
  const unsettled = findUnsettledToolCalls(rows);

  if (unsettled.length === 0) {
    return [];
  }

  const issuedAt =
    readTimestamp([...rows].reverse().find((row) => row.role === "assistant")) ?? Date.now() - 1;
  const settlements = unsettled.map((call) => {
    const effectClass = resolveToolCallEffectClass({
      toolName: call.name,
      effects: functionToolDescriptors.find((descriptor) => descriptor.name === call.name)?.effects,
      rawArguments: call.arguments,
    });

    return { call, ...settleInterruptedCall(call.name, effectClass) };
  });
  const messages: Message[] = settlements.map(({ call, content, outcome }) => ({
    id: generateId(),
    role: "tool",
    name: call.name,
    content,
    status: "error",
    tool_call_id: call.id,
    tool_call_arguments:
      typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}),
    timestamp: issuedAt + 1,
    data: { errorCode: "RUN_INTERRUPTED", outcome },
  }));

  const saved = await withThreadLockIfFree(
    { env: context.env, conversationId: run.conversationId, kind: "durable_recovery" },
    async (lease) => {
      const manager = ConversationManager.getInstance({
        database: context.database,
        user,
        store: true,
        env: context.env,
        writeFence: lease,
      });

      await manager.addBatch(run.conversationId, messages);

      return true;
    },
  );

  return saved === true
    ? settlements.flatMap(({ call, outcome }) => (outcome === "unknown" ? [call.name] : []))
    : null;
}

export async function resumeInterruptedDelegation(params: {
  context: ServiceContext;
  user: IUser;
  run: ChatRun;
  delegation: Delegation;
}): Promise<boolean> {
  const { context, user, run, delegation } = params;

  if (
    run.status !== "interrupted" ||
    delegation.state !== "running" ||
    Date.parse(delegation.budget.deadline) <= Date.now()
  ) {
    return false;
  }

  const attempt = await context.repositories.conversationRuns.countInterruptedForConversation(
    run.conversationId,
  );

  if (attempt < 1 || attempt > MAX_DELEGATION_RUN_RESUMES) {
    return false;
  }

  const previous = await context.repositories.tasks.getTaskById(
    delegationRunTaskId(delegation.id, attempt > 1 ? attempt - 1 : undefined),
  );
  const taskData = delegationRunTaskDataSchema.safeParse(previous?.task_data);

  if (!taskData.success) {
    return false;
  }

  const [hydratedRun] = await hydrateChatRunUsage(context.repositories, [run]);
  const previousSteps = taskData.data.resume?.maxSteps ?? delegation.budget.maxSteps;
  const previousCreditMicros =
    taskData.data.resume?.maxCreditMicros ?? delegation.budget.maxCreditMicros;
  const maxSteps = previousSteps - (run.context?.step ?? 0);
  const maxCreditMicros =
    previousCreditMicros - (hydratedRun?.usage?.consumption.creditMicros ?? 0);

  if (maxSteps <= 0 || maxCreditMicros <= 0) {
    return false;
  }

  try {
    const unknownOutcomes = await settleUnsettledToolCalls(context, user, run);

    if (!unknownOutcomes) {
      return false;
    }

    await new TaskService(context.env, context.repositories.tasks).enqueueTask({
      id: delegationRunTaskId(delegation.id, attempt),
      task_type: DELEGATION_RUN_TASK_TYPE,
      user_id: user.id,
      ...(taskData.data.projectId ? { project_id: taskData.data.projectId } : {}),
      priority: 4,
      task_data: {
        delegationId: delegation.id,
        projectId: taskData.data.projectId,
        enabledTools: taskData.data.enabledTools,
        resume: {
          attempt,
          unknownOutcomes: unknownOutcomes.slice(0, 32),
          maxSteps,
          maxCreditMicros,
        },
      },
    });

    return true;
  } catch (error) {
    logger.warn("Could not resume an interrupted delegation", {
      delegationId: delegation.id,
      runId: run.id,
      error: getErrorMessage(error),
    });

    return false;
  }
}
