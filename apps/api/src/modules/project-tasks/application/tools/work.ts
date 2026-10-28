import {
  creditMicrosFromCredits,
  projectTaskPrioritySchema,
  proposeHireSchema,
  raiseCaseSchema,
  setupPlanSchema,
  WORK_HEARTBEAT_MAX_MINUTES,
  userQuestionAnswerSchema,
  WORK_HEARTBEAT_MIN_MINUTES,
} from "@ngriffin_uk/polychat-schemas";
import { readTrimmedString, readTrimmedStringArray } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

import {
  acceptTaskBreakdown,
  proposeTaskBreakdown,
} from "~/modules/project-tasks/application/breakdown";
import { linkTaskPullRequest } from "~/modules/project-tasks/application/pull-request-feedback";
import { answerStandup, summariseStandup } from "~/modules/project-tasks/application/standups";
import {
  answerReportQuestions,
  assignTask,
  blockTask,
  commentOnTask,
  draftCaseReply,
  escalateTask,
  raiseCase,
  requestReview,
  requireTaskInProject,
  reviewTask,
} from "~/modules/project-tasks/application/work";
import { taskReference } from "~/modules/project-tasks/domain/work-actors";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { setReportBudget } from "~/modules/teammates/application/budgets";
import { proposeHire } from "~/modules/teammates/application/organisation";
import { proposeSetupPlan } from "~/modules/workspaces/application/onboarding";
import type { ApiToolDefinition } from "~/types/functions";

import {
  accept_breakdown as acceptBreakdownDescriptor,
  answer_standup as answerStandupDescriptor,
  assign_task as assignTaskDescriptor,
  answer_questions as answerQuestionsDescriptor,
  block_task as blockTaskDescriptor,
  draft_reply as draftReplyDescriptor,
  escalate as escalateDescriptor,
  post_update as postUpdateDescriptor,
  propose_breakdown as proposeBreakdownDescriptor,
  propose_hire as proposeHireDescriptor,
  propose_setup_plan as proposeSetupPlanDescriptor,
  raise_case as raiseCaseDescriptor,
  request_review as requestReviewDescriptor,
  review_task as reviewTaskDescriptor,
  link_pull_request as linkPullRequestDescriptor,
  set_budget as setBudgetDescriptor,
  summarise_standup as summariseStandupDescriptor,
} from "./definitions/work";
import {
  resolveWorkActor,
  resolveWorkReport,
  resolveWorkToolScope,
  type WorkToolScope,
} from "./scope";

const MINUTES_PER_HOUR = 60;

function workTool(
  descriptor: Omit<ApiToolDefinition, "execute">,
  run: (
    args: Record<string, unknown>,
    scope: WorkToolScope,
  ) => Promise<{ content: string; data: Record<string, unknown> }>,
): ApiToolDefinition {
  return {
    ...descriptor,
    execute: async (args, toolContext) => ({
      status: "success",
      name: descriptor.name,
      ...(await run(args, await resolveWorkToolScope(toolContext.request))),
    }),
  };
}

function describeTask(task: { key: string | null; id: string; objective: string; status: string }) {
  return `${taskReference(task)} ${task.objective} (${task.status})`;
}

export const assign_task = workTool(assignTaskDescriptor, async (args, scope) => {
  const owner = await resolveWorkActor(scope, args.owner);
  const task = await assignTask(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    owner,
    scope.caller,
  );

  return { content: `Assigned: ${describeTask(task)}`, data: { task } };
});

export const post_update = workTool(postUpdateDescriptor, async (args, scope) => {
  const post = await commentOnTask(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    readTrimmedString(args.body),
    scope.caller,
  );

  return { content: "Posted to the task thread.", data: { post } };
});

export const block_task = workTool(blockTaskDescriptor, async (args, scope) => {
  const unblocker = await resolveWorkActor(scope, args.unblocker);
  const task = await blockTask(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    readTrimmedString(args.reason),
    unblocker,
    scope.caller,
  );

  return { content: `Blocked: ${describeTask(task)}`, data: { task } };
});

export const request_review = workTool(requestReviewDescriptor, async (args, scope) => {
  const reviewer = await resolveWorkActor(scope, args.reviewer);
  const task = await requestReview(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    reviewer,
    readTrimmedString(args.note) || null,
    scope.caller,
  );

  return { content: `Sent for review: ${describeTask(task)}`, data: { task } };
});

export const review_task = workTool(reviewTaskDescriptor, async (args, scope) => {
  const task = await reviewTask(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    args.decision === "accept" ? "accept" : "changes",
    readTrimmedString(args.note),
    scope.caller,
  );

  return { content: `Reviewed: ${describeTask(task)}`, data: { task } };
});

export const escalate = workTool(escalateDescriptor, async (args, scope) => {
  const task = await escalateTask(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    readTrimmedString(args.reason),
    scope.caller,
  );

  return { content: `Escalated: ${describeTask(task)}`, data: { task } };
});

export const raise_case = workTool(raiseCaseDescriptor, async (args, scope) => {
  const origin = readTrimmedString(args.raisedFromTaskId);
  const originTask = origin
    ? await scope.context.repositories
        .get(ProjectTaskRepository)
        .getTaskByReference(scope.projectId, origin)
    : null;
  const input = raiseCaseSchema.parse({
    title: readTrimmedString(args.title),
    description: readTrimmedString(args.description) || null,
    priority: projectTaskPrioritySchema.safeParse(args.priority).data ?? "none",
    raisedFromTaskId: originTask?.id ?? null,
  });
  const task = await raiseCase(scope.context, scope.projectId, input, scope.caller);

  return { content: `Raised case ${describeTask(task)} and sent it to Triage.`, data: { task } };
});

export const propose_hire = workTool(proposeHireDescriptor, async (args, scope) => {
  const manager = readTrimmedString(args.reportsTo)
    ? await resolveWorkActor(scope, args.reportsTo)
    : scope.caller.actor;
  const heartbeatHours = typeof args.heartbeatHours === "number" ? args.heartbeatHours : null;
  const input = proposeHireSchema.parse({
    name: readTrimmedString(args.name),
    title: readTrimmedString(args.title),
    roleSlug: readTrimmedString(args.roleSlug) || null,
    jobDescription: readTrimmedString(args.jobDescription) || null,
    reportsToTeammateId: manager.type === "teammate" ? manager.id : null,
    monthlyCreditCapMicros:
      typeof args.monthlyCredits === "number" && args.monthlyCredits > 0
        ? creditMicrosFromCredits(args.monthlyCredits)
        : null,
    heartbeatMinutes: heartbeatHours
      ? Math.min(
          WORK_HEARTBEAT_MAX_MINUTES,
          Math.max(WORK_HEARTBEAT_MIN_MINUTES, Math.round(heartbeatHours * MINUTES_PER_HOUR)),
        )
      : null,
    projectIds: [scope.projectId],
    reason: readTrimmedString(args.reason),
  });
  const proposed = await proposeHire(scope.context, scope.workspaceId, input, {
    teammateId: scope.caller.actor.type === "teammate" ? scope.caller.actor.id : null,
  });

  return {
    content: `Proposed hiring ${proposed.name} as ${proposed.title}. A person decides in Inbox.`,
    data: { teammate: proposed },
  };
});

export const link_pull_request = workTool(linkPullRequestDescriptor, async (args, scope) => {
  const task = await linkTaskPullRequest(
    scope.context,
    await requireTaskInProject(scope.context, scope.projectId, readTrimmedString(args.taskId)),
    readTrimmedString(args.url),
    scope.caller,
  );
  const pullRequest = task.details.pullRequest;

  return {
    content: pullRequest
      ? `Linked ${pullRequest.repository}#${pullRequest.number} to ${describeTask(task)}.`
      : `Linked the pull request to ${describeTask(task)}.`,
    data: { task },
  };
});

export const set_budget = workTool(setBudgetDescriptor, async (args, scope) => {
  if (scope.caller.actor.type !== "teammate") {
    throw new Error("Change budgets on the Team page.");
  }

  if (typeof args.monthlyCredits !== "number" || args.monthlyCredits <= 0) {
    throw new Error("Give the new monthly budget as a positive number of credits.");
  }

  const updated = await setReportBudget(scope.context, {
    workspaceId: scope.workspaceId,
    managerId: scope.caller.actor.id,
    teammateId: await resolveWorkReport(scope, args.teammate),
    monthlyCreditCapMicros: creditMicrosFromCredits(args.monthlyCredits),
    reason: readTrimmedString(args.reason),
  });

  return {
    content: `Set the monthly budget to ${args.monthlyCredits} credits${updated.status === "active" ? "" : ". It is still paused"}.`,
    data: {
      teammateId: updated.teammateId,
      monthlyCreditCapMicros: updated.monthlyCreditCapMicros,
    },
  };
});

export const answer_standup = workTool(answerStandupDescriptor, async (args, scope) => {
  const task = await scope.context.repositories
    .get(ProjectTaskRepository)
    .getTaskByReference(scope.projectId, readTrimmedString(args.taskId));
  const questions = task?.details.standup?.questions ?? [];
  const answers = readTrimmedStringArray(args.answers);
  const updated = await answerStandup(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    { answers: questions.map((question, index) => ({ question, answer: answers[index] ?? "" })) },
    scope.caller,
  );

  return { content: "Answered standup.", data: { task: updated } };
});

export const summarise_standup = workTool(summariseStandupDescriptor, async (args, scope) => {
  const task = await summariseStandup(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    readTrimmedString(args.summary),
    scope.caller,
  );

  return { content: "Standup closed.", data: { task } };
});

export const propose_setup_plan = workTool(proposeSetupPlanDescriptor, async (args, scope) => {
  const plan = setupPlanSchema.safeParse(args.plan);

  if (!plan.success) {
    throw new Error(`The setup plan is not valid: ${plan.error.message}`);
  }

  const state = await proposeSetupPlan(scope.context, scope.workspaceId, plan.data, scope.caller);

  return {
    content: `Setup plan revision ${state.revision} is waiting for approval in Inbox.`,
    data: { setup: state },
  };
});

export const draft_reply = workTool(draftReplyDescriptor, async (args, scope) => {
  const task = await draftCaseReply(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    readTrimmedString(args.body),
    scope.caller,
  );

  return {
    content: `Drafted a reply on ${taskReference(task)}. A person sends it.`,
    data: { task },
  };
});

export const answer_questions = workTool(answerQuestionsDescriptor, async (args, scope) => {
  const answers = z.array(userQuestionAnswerSchema).min(1).parse(args.answers);
  const task = await answerReportQuestions(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    answers,
    scope.caller,
  );

  return {
    content: `Answered the questions on ${taskReference(task)}. Its owner carries on.`,
    data: { task },
  };
});

const breakdownArgsSchema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40),
        objective: z.string().trim().min(1).max(2000),
        owner: z.string().trim().max(200).optional(),
        priority: projectTaskPrioritySchema.optional(),
        dependsOn: z.array(z.string().trim().min(1).max(40)).optional(),
      }),
    )
    .min(1),
});

export const propose_breakdown = workTool(proposeBreakdownDescriptor, async (args, scope) => {
  const { items } = breakdownArgsSchema.parse(args);
  const resolved = await Promise.all(
    items.map(async (item) => ({
      key: item.key,
      objective: item.objective,
      owner: item.owner ? await resolveWorkActor(scope, item.owner) : null,
      priority: item.priority ?? "medium",
      dependsOn: item.dependsOn ?? [],
    })),
  );
  const task = await proposeTaskBreakdown(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    resolved,
    scope.caller,
  );

  return {
    content: `Proposed revision ${task.details.breakdown?.revision ?? 1} of the breakdown of ${taskReference(task)}. It waits for your manager or a person to accept it.`,
    data: { task },
  };
});

export const accept_breakdown = workTool(acceptBreakdownDescriptor, async (args, scope) => {
  const revision = z.number().int().positive().parse(args.revision);
  const task = await acceptTaskBreakdown(
    scope.context,
    scope.projectId,
    readTrimmedString(args.taskId),
    revision,
    scope.caller,
  );

  return {
    content: `Accepted the breakdown of ${taskReference(task)}. Its sub-tasks are created and the ready ones have started.`,
    data: { task },
  };
});

export const WORK_TOOLS = [
  assign_task,
  post_update,
  block_task,
  request_review,
  review_task,
  escalate,
  raise_case,
  propose_hire,
  set_budget,
  link_pull_request,
  answer_standup,
  summarise_standup,
  propose_setup_plan,
  draft_reply,
  answer_questions,
  propose_breakdown,
  accept_breakdown,
];
