import {
  PROJECT_TASK_INTERACTION_PROTOCOL_VERSION,
  projectTaskToolApprovalSchema,
  userQuestionAnswerSchema,
  userQuestionsSchema,
  type ProjectTask,
  type ProjectTaskInteraction,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { isRecord } from "~/utils/objects";

import { readInteractionMessageData } from "./interaction-messages";

const answersSchema = z.array(userQuestionAnswerSchema);

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readMessageTime(message: Record<string, unknown>, data: Record<string, unknown>): string {
  const explicit = readString(data.requestedAt) ?? readString(data.timestamp);

  if (explicit) {
    return explicit;
  }

  if (typeof message.timestamp === "number" && Number.isFinite(message.timestamp)) {
    return new Date(message.timestamp).toISOString();
  }

  return readString(message.created_at) ?? "";
}

function readStatus(params: {
  task: ProjectTask;
  data: Record<string, unknown>;
  humanInTheLoop: Record<string, unknown>;
}): ProjectTaskInteraction["status"] {
  const humanStatus = readString(params.humanInTheLoop.status);

  if (humanStatus === "expired" || readString(params.data.expiredAt)) {
    return "expired";
  }

  const resolved =
    params.data.resolved === true ||
    humanStatus === "resolved" ||
    readString(params.data.resolution) !== null;

  if (
    resolved &&
    params.task.status === "blocked" &&
    params.task.blockedReason === "dispatch_failed"
  ) {
    return "interrupted";
  }

  if (resolved) {
    return "resolved";
  }

  const expectedBlockedReason =
    params.humanInTheLoop.type === "question" ? "awaiting_input" : "awaiting_approval";

  return params.task.status === "blocked" && params.task.blockedReason === expectedBlockedReason
    ? "pending"
    : "interrupted";
}

export async function getProjectTaskInteraction(
  context: ServiceContext,
  task: ProjectTask,
): Promise<ProjectTaskInteraction | null> {
  if (!task.conversationId) {
    return null;
  }

  const message = await context.repositories.messages.getLatestProjectTaskInteractionMessage(
    task.conversationId,
  );
  const data = readInteractionMessageData(message?.data);
  const humanInTheLoop = data && isRecord(data.humanInTheLoop) ? data.humanInTheLoop : null;

  if (!message || !data || !humanInTheLoop) {
    return null;
  }

  const messageRunId = readString(message.run_id);

  if (task.runId && messageRunId && task.runId !== messageRunId) {
    return null;
  }

  const type = humanInTheLoop.type;
  const interactionId =
    readString(humanInTheLoop.interactionId) ??
    readString(data.interactionId) ??
    (isRecord(data.approval) ? readString(data.approval.interactionId) : null);

  if ((type !== "question" && type !== "approval") || !interactionId) {
    return null;
  }

  const status = readStatus({ task, data, humanInTheLoop });
  const common = {
    protocolVersion: PROJECT_TASK_INTERACTION_PROTOCOL_VERSION,
    projectId: task.projectId,
    taskId: task.id,
    runId: task.runId ?? messageRunId ?? null,
    interactionId,
    status,
    requestedAt: readMessageTime(message, data),
    resolvedAt: readString(data.resolvedAt) ?? readString(data.expiredAt),
    detail: status === "interrupted" ? task.blockedDetail : null,
  } as const;

  if (type === "question") {
    const questions = userQuestionsSchema.safeParse(data.questions ?? humanInTheLoop.questions);

    if (!questions.success) {
      return null;
    }

    const answers = answersSchema.safeParse(data.answers ?? humanInTheLoop.answers);

    return {
      ...common,
      type,
      questions: questions.data,
      answers: answers.success ? answers.data : null,
    };
  }

  const approval = projectTaskToolApprovalSchema.safeParse(data.approval);

  if (!approval.success || approval.data.interactionId !== interactionId) {
    return null;
  }

  const resolution = data.resolution ?? humanInTheLoop.resolution;

  return {
    ...common,
    type,
    toolName: approval.data.toolName,
    reason: approval.data.reason,
    resolution: resolution === "approved" || resolution === "rejected" ? resolution : null,
  };
}
