import {
  projectTaskPrioritySchema,
  projectTaskStatusLabels,
  type Goal,
  type ProjectTask,
  type ProjectTaskStatus,
  type ProjectTaskThreadPost,
  type UserQuestionSet,
} from "@ngriffin_uk/polychat-schemas";
import { readTrimmedStringArray, truncateText } from "@ngriffin_uk/polychat-utility-core";

import {
  createProjectTask,
  getProjectTask,
  listProjectTasks,
  updateProjectTask,
} from "~/modules/project-tasks/application";
import { assignTask } from "~/modules/project-tasks/application/work";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import type { ApiToolDefinition } from "~/types/functions";

import {
  create_task as create_taskDescriptor,
  list_tasks as list_tasksDescriptor,
  get_task as get_taskDescriptor,
  update_task as update_taskDescriptor,
  MODEL_SETTABLE_STATUSES,
} from "./definitions/projectTasks";
import { readText, requireProjectId, resolveWorkActor, resolveWorkToolScope } from "./scope";

const MAX_LISTED_TASKS = 25;
const THREAD_EXCERPT_POSTS = 8;
const THREAD_EXCERPT_CHARS = 600;

function formatTask(task: ProjectTask): string {
  const stage = task.stageId ? ` [${task.stageId}]` : "";
  const criteria = task.acceptanceCriteria.length
    ? ` (${task.acceptanceCriteria.length} criteria)`
    : "";
  const blocked = task.blockedDetail ? ` — ${task.blockedDetail}` : "";

  return `${task.key ?? task.id}${stage}: ${task.objective}${criteria} (${projectTaskStatusLabels[task.status]})${blocked}`;
}

function formatTaskDetail(params: {
  task: ProjectTask;
  goal: Goal | null;
  pendingQuestions: UserQuestionSet | null;
  thread: readonly ProjectTaskThreadPost[];
}): string {
  const { task, goal, pendingQuestions, thread } = params;
  const lines = [formatTask(task)];

  if (task.description) {
    lines.push(`Details: ${task.description}`);
  }

  if (task.expectedOutput) {
    lines.push(`Expected output: ${task.expectedOutput}`);
  }

  if (task.acceptanceCriteria.length > 0) {
    lines.push(
      "Done when:",
      ...task.acceptanceCriteria.map((criterion) => `- ${criterion.id}: ${criterion.text}`),
    );
  }

  if (task.assumptions.length > 0) {
    const outcomes = new Map(
      (task.retrospective?.assumptions ?? []).map((entry) => [entry.id, entry.outcome]),
    );

    lines.push(
      "Rests on:",
      ...task.assumptions.map((assumption) => {
        const outcome = outcomes.get(assumption.id);

        return `- ${assumption.statement}${outcome ? ` (${outcome})` : ""}`;
      }),
    );
  }

  if (task.killConditions.length > 0) {
    lines.push("Stop if:", ...task.killConditions.map((condition) => `- ${condition.condition}`));
  }

  if (goal) {
    lines.push(`Goal: ${goal.status}`);

    if (goal.stopped_reason) {
      lines.push(`Stopped reason: ${goal.stopped_reason}`);
    }

    if (goal.evidence?.length) {
      lines.push(
        "Evidence:",
        ...goal.evidence.map(
          (entry) =>
            `- ${entry.status}: ${entry.claim} — ${entry.route} (${entry.evidence_surface})`,
        ),
      );
    }
  }

  if (pendingQuestions) {
    lines.push(
      `Waiting on answers (interaction ${pendingQuestions.interactionId}):`,
      ...pendingQuestions.questions.map((question) => {
        const options = question.options.map((option) => option.label).join(" / ");

        return `- [${question.id}] ${question.prompt}${options ? ` (options: ${options})` : ""}`;
      }),
    );
  }

  const recent = thread.filter((post) => post.kind !== "event").slice(-THREAD_EXCERPT_POSTS);

  if (recent.length > 0) {
    lines.push(
      "Recent thread:",
      ...recent.map(
        (post) =>
          `- ${post.author.name}: ${truncateText(post.body.replaceAll("\n", " "), THREAD_EXCERPT_CHARS)}`,
      ),
    );
  }

  return lines.join("\n");
}

function readDueAt(value: unknown): string | null {
  const text = readText(value);

  return text && !Number.isNaN(Date.parse(text)) ? new Date(text).toISOString() : null;
}

export const create_task: ApiToolDefinition = {
  ...create_taskDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const parentReference = readText(args.parentTaskId);
    const parent = parentReference
      ? await scope.context.repositories
          .get(ProjectTaskRepository)
          .getTaskByReference(scope.projectId, parentReference)
      : null;

    if (parentReference && !parent) {
      throw new Error(`There is no task ${parentReference} on this board.`);
    }

    const { task } = await createProjectTask(
      scope.context,
      scope.projectId,
      {
        objective: readText(args.objective),
        acceptanceCriteria: Array.isArray(args.acceptanceCriteria)
          ? args.acceptanceCriteria
              .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
              .map((text) => ({ text: text.trim() }))
          : undefined,
        assumptions: readTrimmedStringArray(args.assumptions).map((statement) => ({ statement })),
        killConditions: readTrimmedStringArray(args.killConditions).map((condition) => ({
          condition,
        })),
        expectedOutput: readText(args.expectedOutput) || null,
        stageId: readText(args.stageId) || null,
        description: readText(args.description) || null,
        parentTaskId: parent?.id ?? null,
        priority: projectTaskPrioritySchema.safeParse(args.priority).data ?? "none",
        dueAt: readDueAt(args.dueAt),
      },
      { source: scope.caller.actor.type === "teammate" ? "model" : "user" },
    );
    const owned = readText(args.owner)
      ? await assignTask(
          scope.context,
          scope.projectId,
          task.id,
          await resolveWorkActor(scope, args.owner),
          scope.caller,
        )
      : task;

    return {
      status: "success",
      name: "create_task",
      content: `Added to the work queue: ${formatTask(owned)}`,
      data: { task: owned },
    };
  },
};

export const list_tasks: ApiToolDefinition = {
  ...list_tasksDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const status =
      typeof args.status === "string" && args.status in projectTaskStatusLabels
        ? (args.status as ProjectTaskStatus)
        : undefined;
    const { tasks } = await listProjectTasks(request.context, projectId, {
      status,
    });
    const visible = tasks.slice(0, MAX_LISTED_TASKS);

    return {
      status: "success",
      name: "list_tasks",
      content: visible.length
        ? `Work queue:\n${visible.map(formatTask).join("\n")}`
        : "This work queue has no tasks matching that filter.",
      data: { renderer: "project_task_list", tasks: visible, total: tasks.length },
    };
  },
};

export const get_task: ApiToolDefinition = {
  ...get_taskDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const reference = await request.context.repositories
      .get(ProjectTaskRepository)
      .getTaskByReference(projectId, readText(args.taskId));
    const result = await getProjectTask(
      request.context,
      projectId,
      reference?.id ?? readText(args.taskId),
    );

    return {
      status: "success",
      name: "get_task",
      content: formatTaskDetail(result),
      data: result,
    };
  },
};

export const update_task: ApiToolDefinition = {
  ...update_taskDescriptor,
  execute: async (args, toolContext) => {
    const request = toolContext.request;
    const projectId = requireProjectId(request);

    if (!request.context) {
      throw new Error("Signed-in project context is required for project task tools");
    }

    const status =
      typeof args.status === "string" &&
      MODEL_SETTABLE_STATUSES.includes(args.status as ProjectTaskStatus)
        ? (args.status as ProjectTaskStatus)
        : undefined;
    const reference = await request.context.repositories
      .get(ProjectTaskRepository)
      .getTaskByReference(projectId, readText(args.taskId));
    const { task } = await updateProjectTask(
      request.context,
      projectId,
      reference?.id ?? readText(args.taskId),
      {
        ...(typeof args.objective === "string" ? { objective: args.objective.trim() } : {}),
        ...(Array.isArray(args.acceptanceCriteria)
          ? {
              acceptanceCriteria: args.acceptanceCriteria
                .filter(
                  (entry): entry is string => typeof entry === "string" && entry.trim() !== "",
                )
                .map((text) => ({ text: text.trim() })),
            }
          : {}),
        ...(Array.isArray(args.assumptions)
          ? {
              assumptions: readTrimmedStringArray(args.assumptions).map((statement) => ({
                statement,
              })),
            }
          : {}),
        ...(Array.isArray(args.killConditions)
          ? {
              killConditions: readTrimmedStringArray(args.killConditions).map((condition) => ({
                condition,
              })),
            }
          : {}),
        ...(status ? { status } : {}),
        ...(typeof args.description === "string"
          ? { description: args.description.trim() || null }
          : {}),
        ...(projectTaskPrioritySchema.safeParse(args.priority).success
          ? { priority: projectTaskPrioritySchema.parse(args.priority) }
          : {}),
        ...(readDueAt(args.dueAt) ? { dueAt: readDueAt(args.dueAt) } : {}),
      },
      { actor: "model" },
    );

    return {
      status: "success",
      name: "update_task",
      content: `Updated: ${formatTask(task)}`,
      data: { task },
    };
  },
};
