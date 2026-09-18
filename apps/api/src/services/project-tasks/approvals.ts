import { mergeHumanInTheLoop } from "@ngriffin_uk/polychat-library-interactions";
import {
  projectTaskToolApprovalSchema,
  resolveProjectTaskToolApprovalSchema,
  type ProjectTask,
  type ProjectTaskToolApproval,
  type ResolveProjectTaskToolApprovalInput,
} from "@ngriffin_uk/polychat-schemas";
import { isRecord } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { resolveTelemetryIdentity } from "~/lib/telemetry";
import { recordChatRunOperationalMetric } from "~/services/chat-runs/operational-metrics";

import {
  readPendingInteractionMessage,
  resolvePendingInteraction,
  type PendingInteractionMessage,
} from "./interaction-resolution";

function getPendingApprovalMessage(
  context: ServiceContext,
  conversationId: string,
): Promise<PendingInteractionMessage<ProjectTaskToolApproval> | null> {
  return readPendingInteractionMessage({
    context,
    conversationId,
    parse: (data) => {
      const approval = projectTaskToolApprovalSchema.safeParse(
        isRecord(data.approval) ? data.approval : undefined,
      );

      return approval.success ? approval.data : null;
    },
  });
}

export async function getPendingProjectTaskToolApproval(
  context: ServiceContext,
  task: Pick<ProjectTask, "conversationId">,
): Promise<ProjectTaskToolApproval | null> {
  if (!task.conversationId) {
    return null;
  }

  const pending = await getPendingApprovalMessage(context, task.conversationId);

  return pending?.interaction ?? null;
}

export async function resolveProjectTaskToolApproval(params: {
  context: ServiceContext;
  task: ProjectTask;
  input: ResolveProjectTaskToolApprovalInput;
}): Promise<{ toolName: string; resolution: "approved" | "rejected" }> {
  const { context, task } = params;
  const input = resolveProjectTaskToolApprovalSchema.parse(params.input);

  if (task.status !== "blocked" || task.blockedReason !== "awaiting_approval") {
    throw new AssistantError(
      "This task is not waiting for tool approval",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (!task.conversationId) {
    throw new AssistantError(
      "This task has no conversation to resume",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const conversationId = task.conversationId;
  const pending = await getPendingApprovalMessage(context, conversationId);

  if (!pending || pending.interaction.interactionId !== input.interactionId) {
    throw new AssistantError(
      "This approval is no longer pending. Refresh the conversation.",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  const resolved = await resolvePendingInteraction<ProjectTaskToolApproval>({
    context,
    task,
    conversationId,
    expectedInteractionId: input.interactionId,
    interactionIdOf: (approval) => approval.interactionId,
    conflictMessage: "This approval is no longer pending. Refresh the conversation.",
    readPending: (id) => getPendingApprovalMessage(context, id),
    buildResolution: (current) => ({
      data: {
        ...current.data,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolution: input.resolution,
        approval: {
          ...current.interaction,
          status: input.resolution,
        },
        humanInTheLoop: mergeHumanInTheLoop(current.data.humanInTheLoop, {
          status: "resolved",
          interactionId: input.interactionId,
          toolName: current.interaction.toolName,
          resolution: input.resolution,
          requires_user_action: false,
        }),
      },
      toolName: current.interaction.toolName,
      toolContent:
        input.resolution === "approved" ? "Tool access approved." : "Tool access rejected.",
      userContent:
        input.resolution === "approved"
          ? `Approved access to ${current.interaction.toolName}. Continue the task.`
          : `Rejected access to ${current.interaction.toolName}. Continue without it.`,
      userData: {
        toolApprovalResponse: {
          interactionId: input.interactionId,
          resolution: input.resolution,
          toolName: current.interaction.toolName,
        },
      },
    }),
  });

  if (pending.timestamp !== undefined) {
    recordChatRunOperationalMetric(context.env, {
      signal: "approval_latency",
      runId: task.runId ?? undefined,
      taskId: task.id,
      outcome: "success",
      value: Math.max(0, Date.now() - pending.timestamp),
      identity: resolveTelemetryIdentity(context),
    });
  }

  return { toolName: resolved.interaction.toolName, resolution: input.resolution };
}
