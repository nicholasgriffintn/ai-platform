import {
  PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
  type ChatRun,
  type ChatRunEvent,
  type Goal,
  type ProjectTask,
  type ProjectTaskActivityItem,
  type ProjectTaskActivityStatus,
  type ProjectTaskActivityTimeline,
  type ProjectTaskInteraction,
} from "@ngriffin_uk/polychat-schemas";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { formatStoredMessage } from "~/lib/conversation/stored-message";
import type { Message } from "~/types";
import { isRecord } from "~/utils/objects";

interface ActivityCompletion {
  id: string;
  output: string;
  approval: { status: "pending" | "approved" | "rejected" };
  conversationId?: string;
  createdAt: string;
}

export interface ProjectTaskActivityTask extends Pick<
  ProjectTask,
  "id" | "projectId" | "createdAt" | "acceptanceCriteria"
> {
  completions: ActivityCompletion[];
}

export interface ProjectTaskActivityRun {
  run: ChatRun;
  events: ChatRunEvent[];
  messages: Message[];
}

interface ProjectTaskActivityInput {
  task: ProjectTaskActivityTask;
  goal: Pick<Goal, "progress"> | null;
  interaction: ProjectTaskInteraction | null;
  runs: ProjectTaskActivityRun[];
}

function activityItem(
  task: ProjectTaskActivityTask,
  item: Omit<ProjectTaskActivityItem, "protocolVersion" | "projectId" | "taskId">,
): ProjectTaskActivityItem {
  return {
    protocolVersion: PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
    projectId: task.projectId,
    taskId: task.id,
    ...item,
  };
}

function normaliseTimestamp(value: number | string | undefined, fallback: string): string {
  const timestamp = typeof value === "number" ? value : Date.parse(value ?? "");

  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function shorten(value: string, limit = 320): string {
  const normalised = value.replace(/\s+/g, " ").trim();

  return normalised.length <= limit ? normalised : `${normalised.slice(0, limit - 1).trimEnd()}…`;
}

function displayToolName(name: string | undefined): string {
  if (!name) {
    return "tool";
  }

  return name.replace(/[_-]+/g, " ");
}

function toolResultStatus(
  part: Extract<NonNullable<Message["parts"]>[number], { type: "tool_result" }>,
): "active" | "failed" | "succeeded" {
  const status = part.status ?? (isRecord(part.content) ? part.content.status : undefined);

  if (typeof status === "string" && /pending|running|progress/i.test(status)) {
    return "active";
  }

  if (
    (typeof status === "string" && /fail|error|denied|cancel/i.test(status)) ||
    (isRecord(part.content) && typeof part.content.error === "string") ||
    (typeof part.content === "string" && /^\s*(error|failed)\b/i.test(part.content))
  ) {
    return "failed";
  }

  return "succeeded";
}

function runStatus(status: unknown): ProjectTaskActivityStatus {
  switch (status) {
    case "accepted":
    case "running":
    case "cancelling":
      return "active";
    case "awaiting_input":
    case "awaiting_approval":
      return "waiting";
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "interrupted":
      return "interrupted";
    default:
      return "unknown";
  }
}

function runTitle(status: ProjectTaskActivityStatus, rawStatus?: unknown): string {
  if (rawStatus === "awaiting_input") {
    return "Run waiting for an answer";
  }

  if (rawStatus === "awaiting_approval") {
    return "Run waiting for approval";
  }

  if (rawStatus === "cancelling") {
    return "Stop requested";
  }

  switch (status) {
    case "active":
      return "Run in progress";
    case "waiting":
      return "Run waiting for you";
    case "succeeded":
      return "Run completed";
    case "failed":
      return "Run failed";
    case "cancelled":
      return "Run cancelled";
    case "interrupted":
      return "Run interrupted";
    case "proposed":
    case "resolved":
    case "unknown":
      return "Task activity";
  }

  return "Task activity";
}

function isTerminalStatus(status: ProjectTaskActivityStatus): boolean {
  return ["succeeded", "failed", "cancelled", "interrupted", "resolved"].includes(status);
}

function projectRunEvent(
  task: ProjectTaskActivityTask,
  event: ChatRunEvent,
): ProjectTaskActivityItem {
  const known = event.type === "run.accepted" || event.type === "run.status_changed";
  const status = known ? runStatus(event.data.status) : "unknown";

  return activityItem(task, {
    id: `run-event:${event.id}`,
    runId: event.runId,
    type: event.type,
    category: "run",
    status,
    title: runTitle(status, event.data.status),
    detail: known
      ? typeof event.data.terminalReason === "string"
        ? shorten(event.data.terminalReason)
        : null
      : event.type,
    items: [],
    occurredAt: event.occurredAt,
    sourceId: event.id,
    actionable: status === "waiting",
    terminal: isTerminalStatus(status),
  });
}

function projectRunSnapshot(task: ProjectTaskActivityTask, run: ChatRun): ProjectTaskActivityItem {
  const status = runStatus(run.status);

  return activityItem(task, {
    id: `run-snapshot:${run.id}:${run.attempt}`,
    runId: run.id,
    type: "run.snapshot",
    category: "run",
    status,
    title: runTitle(status, run.status),
    detail: run.terminalReason ? shorten(run.terminalReason) : null,
    items: [],
    occurredAt: run.updatedAt,
    sourceId: run.id,
    actionable: status === "waiting",
    terminal: isTerminalStatus(status),
  });
}

function readMessageInteraction(message: Message): {
  interactionId: string;
  type: "question" | "approval";
  status: "pending" | "resolved" | "expired" | "interrupted";
  detail: string | null;
  items: string[];
  occurredAt: string;
} | null {
  const data = isRecord(message.data) ? message.data : null;
  const humanInTheLoop = data && isRecord(data.humanInTheLoop) ? data.humanInTheLoop : null;
  const approval = data && isRecord(data.approval) ? data.approval : null;
  const type = humanInTheLoop?.type;
  const interactionId =
    typeof humanInTheLoop?.interactionId === "string"
      ? humanInTheLoop.interactionId
      : typeof data?.interactionId === "string"
        ? data.interactionId
        : typeof approval?.interactionId === "string"
          ? approval.interactionId
          : null;

  if ((type !== "question" && type !== "approval") || !interactionId || !data) {
    return null;
  }

  const humanStatus = humanInTheLoop.status;
  const status =
    humanStatus === "expired" || typeof data.expiredAt === "string"
      ? "expired"
      : data.resolved === true ||
          humanStatus === "resolved" ||
          data.resolution === "approved" ||
          data.resolution === "rejected"
        ? "resolved"
        : humanStatus === "pending"
          ? "pending"
          : "interrupted";
  const requestedAt =
    typeof data.requestedAt === "string"
      ? data.requestedAt
      : normaliseTimestamp(message.timestamp, "");

  if (type === "question") {
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const prompts = questions.flatMap((question) =>
      isRecord(question) && typeof question.prompt === "string" ? [shorten(question.prompt)] : [],
    );

    return {
      interactionId,
      type,
      status,
      detail: prompts[0] ?? null,
      items: prompts,
      occurredAt: requestedAt,
    };
  }

  return {
    interactionId,
    type,
    status,
    detail: typeof approval?.reason === "string" ? shorten(approval.reason) : null,
    items: [],
    occurredAt: requestedAt,
  };
}

function projectInteraction(
  task: ProjectTaskActivityTask,
  interaction: ProjectTaskInteraction,
): ProjectTaskActivityItem {
  const status =
    interaction.status === "pending"
      ? "waiting"
      : interaction.status === "resolved"
        ? "resolved"
        : "interrupted";
  const questionItems =
    interaction.type === "question" ? interaction.questions.map((question) => question.prompt) : [];
  const title =
    interaction.status === "pending"
      ? interaction.type === "question"
        ? "Waiting for your answer"
        : "Waiting for your approval"
      : interaction.status === "resolved"
        ? interaction.type === "question"
          ? "Questions answered"
          : "Approval resolved"
        : interaction.status === "expired"
          ? "Request expired"
          : "Request interrupted";

  return activityItem(task, {
    id: `interaction:${interaction.runId ?? "task"}:${interaction.interactionId}`,
    runId: interaction.runId,
    type: interaction.status === "pending" ? "interaction.requested" : "interaction.resolved",
    category: "interaction",
    status,
    title,
    detail:
      interaction.detail ??
      (interaction.type === "approval" ? interaction.reason : (questionItems[0] ?? null)),
    items: questionItems,
    occurredAt: interaction.resolvedAt ?? interaction.requestedAt,
    sourceId: interaction.interactionId,
    actionable: interaction.status === "pending",
    terminal: interaction.status !== "pending",
  });
}

function projectMessageParts(
  task: ProjectTaskActivityTask,
  activityRun: ProjectTaskActivityRun,
  currentInteraction: ProjectTaskInteraction | null,
): ProjectTaskActivityItem[] {
  const items: ProjectTaskActivityItem[] = [];

  for (const message of activityRun.messages) {
    if (message.run_id !== activityRun.run.id) {
      continue;
    }

    const historicalInteraction = readMessageInteraction(message);

    if (historicalInteraction) {
      const isCurrentInteraction =
        historicalInteraction.interactionId === currentInteraction?.interactionId &&
        (!currentInteraction.runId || currentInteraction.runId === activityRun.run.id);

      if (!isCurrentInteraction) {
        const status = historicalInteraction.status === "resolved" ? "resolved" : "interrupted";

        items.push(
          activityItem(task, {
            id: `interaction:${activityRun.run.id}:${historicalInteraction.interactionId}`,
            runId: activityRun.run.id,
            type:
              historicalInteraction.status === "pending"
                ? "interaction.interrupted"
                : "interaction.resolved",
            category: "interaction",
            status,
            title:
              historicalInteraction.status === "resolved"
                ? historicalInteraction.type === "question"
                  ? "Questions answered"
                  : "Approval resolved"
                : historicalInteraction.status === "expired"
                  ? "Request expired"
                  : "Request interrupted",
            detail: historicalInteraction.detail,
            items: historicalInteraction.items,
            occurredAt: historicalInteraction.occurredAt || activityRun.run.createdAt,
            sourceId: message.id ?? historicalInteraction.interactionId,
            actionable: false,
            terminal: true,
          }),
        );
      }

      continue;
    }

    for (const [partIndex, part] of (message.parts ?? []).entries()) {
      if (part.type !== "tool_use" && part.type !== "tool_result") {
        continue;
      }

      const occurredAt = normaliseTimestamp(
        part.timestamp ?? message.timestamp,
        activityRun.run.createdAt,
      );
      const sourceId = part.toolCallId ?? part.id ?? message.id ?? `${partIndex}`;
      const name = displayToolName(part.name);

      if (part.type === "tool_use") {
        items.push(
          activityItem(task, {
            id: `${activityRun.run.id}:tool-start:${sourceId}:${partIndex}`,
            runId: activityRun.run.id,
            type: "tool.started",
            category: "tool",
            status: "active",
            title: "Tool started",
            detail: name,
            items: [],
            occurredAt,
            sourceId,
            actionable: false,
            terminal: false,
          }),
        );
      } else {
        const status = toolResultStatus(part);

        items.push(
          activityItem(task, {
            id: `${activityRun.run.id}:tool-result:${sourceId}:${partIndex}`,
            runId: activityRun.run.id,
            type: "tool.completed",
            category: "tool",
            status,
            title:
              status === "failed"
                ? "Tool failed"
                : status === "active"
                  ? "Tool running"
                  : "Tool finished",
            detail: name,
            items: [],
            occurredAt,
            sourceId,
            actionable: false,
            terminal: status !== "active",
          }),
        );
      }
    }
  }

  return items;
}

function closestRunId(
  runs: ProjectTaskActivityRun[],
  occurredAt: string,
  conversationId?: string,
): string | null {
  const timestamp = Date.parse(occurredAt);
  const scopedRuns = runs.filter(
    ({ run }) => !conversationId || run.conversationId === conversationId,
  );
  const eligibleRuns = scopedRuns.filter(({ run }) => Date.parse(run.createdAt) <= timestamp);
  const candidates = eligibleRuns.length > 0 ? eligibleRuns : scopedRuns;
  let latest: ProjectTaskActivityRun | null = null;

  for (const candidate of candidates) {
    if (!latest || Date.parse(candidate.run.createdAt) > Date.parse(latest.run.createdAt)) {
      latest = candidate;
    }
  }

  return latest?.run.id ?? null;
}

export function projectProjectTaskActivity(
  input: ProjectTaskActivityInput,
): ProjectTaskActivityTimeline {
  const { task, goal, interaction, runs } = input;
  const taskRuns = runs.filter(
    ({ run }) => run.projectId === task.projectId && run.projectTaskId === task.id,
  );
  const taskInteraction =
    interaction?.projectId === task.projectId && interaction.taskId === task.id
      ? interaction
      : null;
  const items: ProjectTaskActivityItem[] = [
    activityItem(task, {
      id: `task-plan:${task.id}`,
      runId: null,
      type: "task.plan.proposed",
      category: "plan",
      status: "proposed",
      title: "Plan proposed",
      detail:
        task.acceptanceCriteria.length > 0
          ? `${task.acceptanceCriteria.length} outcome${task.acceptanceCriteria.length === 1 ? "" : "s"} defined`
          : "Task objective and constraints captured",
      items: task.acceptanceCriteria.map((criterion) => criterion.text),
      occurredAt: task.createdAt,
      sourceId: task.id,
      actionable: false,
      terminal: false,
    }),
  ];

  for (const activityRun of taskRuns) {
    const runEvents = activityRun.events.map((event) => projectRunEvent(task, event));
    const hasAuthoritativeStatus = activityRun.events.some(
      (event) =>
        (event.type === "run.accepted" || event.type === "run.status_changed") &&
        event.data.status === activityRun.run.status,
    );

    items.push(...runEvents);

    if (!hasAuthoritativeStatus) {
      items.push(projectRunSnapshot(task, activityRun.run));
    }

    items.push(...projectMessageParts(task, activityRun, taskInteraction));
  }

  for (const entry of goal?.progress ?? []) {
    items.push(
      activityItem(task, {
        id: `goal-step:${entry.iteration}:${entry.at}`,
        runId: closestRunId(taskRuns, entry.at),
        type: "goal.step.recorded",
        category: "step",
        status: "succeeded",
        title: `Step ${entry.iteration}`,
        detail: shorten(entry.summary),
        items: entry.evidence.map((evidence) => shorten(evidence)),
        occurredAt: entry.at,
        sourceId: `${entry.iteration}`,
        actionable: false,
        terminal: true,
      }),
    );
  }

  if (taskInteraction) {
    items.push(projectInteraction(task, taskInteraction));
  }

  for (const completion of task.completions) {
    const status =
      completion.approval.status === "pending"
        ? "waiting"
        : completion.approval.status === "approved"
          ? "succeeded"
          : "failed";

    items.push(
      activityItem(task, {
        id: `output:${completion.id}`,
        runId: closestRunId(taskRuns, completion.createdAt, completion.conversationId),
        type: "output.created",
        category: "output",
        status,
        title:
          completion.approval.status === "pending"
            ? "Result ready for review"
            : completion.approval.status === "approved"
              ? "Result approved"
              : "Result rejected",
        detail: completion.output ? shorten(completion.output) : null,
        items: [],
        occurredAt: completion.createdAt,
        sourceId: completion.id,
        actionable: completion.approval.status === "pending",
        terminal: true,
      }),
    );
  }

  items.sort((left, right) => {
    const timestampDifference = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);

    return timestampDifference === 0 ? right.id.localeCompare(left.id) : timestampDifference;
  });

  return {
    protocolVersion: PROJECT_TASK_ACTIVITY_PROTOCOL_VERSION,
    projectId: task.projectId,
    taskId: task.id,
    items,
  };
}

export async function getProjectTaskActivity(
  context: ServiceContext,
  task: ProjectTask,
  goal: Goal | null,
  interaction: ProjectTaskInteraction | null,
): Promise<ProjectTaskActivityTimeline> {
  const runs = await context.repositories.conversationRuns.listForProjectTask(
    task.projectId,
    task.id,
  );
  const activityRuns = await Promise.all(
    runs.map(async (run) => ({
      run,
      events: await context.repositories.conversationRuns.listEvents(run.id, 0, 500),
      messages: (
        await context.repositories.messages.getRunMessages(run.conversationId, run.id)
      ).map(formatStoredMessage),
    })),
  );

  return projectProjectTaskActivity({ task, goal, interaction, runs: activityRuns });
}
