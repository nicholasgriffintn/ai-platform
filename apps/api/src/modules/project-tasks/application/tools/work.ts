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
import { readTrimmedStringArray } from "@ngriffin_uk/polychat-utility-core";
import z from "zod/v4";

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
  reviewTask,
} from "~/modules/project-tasks/application/work";
import { ProjectTaskRepository } from "~/modules/project-tasks/infrastructure/ProjectTaskRepository";
import { proposeHire } from "~/modules/teammates/application/organisation";
import { proposeSetupPlan } from "~/modules/workspaces/application/onboarding";
import type { ApiToolDefinition } from "~/types/functions";

import {
  answer_standup as answerStandupDescriptor,
  assign_task as assignTaskDescriptor,
  answer_questions as answerQuestionsDescriptor,
  block_task as blockTaskDescriptor,
  draft_reply as draftReplyDescriptor,
  escalate as escalateDescriptor,
  post_update as postUpdateDescriptor,
  propose_hire as proposeHireDescriptor,
  propose_setup_plan as proposeSetupPlanDescriptor,
  raise_case as raiseCaseDescriptor,
  request_review as requestReviewDescriptor,
  review_task as reviewTaskDescriptor,
  summarise_standup as summariseStandupDescriptor,
} from "./definitions/work";
import { readText, resolveWorkActor, resolveWorkToolScope } from "./scope";

const MINUTES_PER_HOUR = 60;

function describeTask(task: { key: string | null; id: string; objective: string; status: string }) {
  return `${task.key ?? task.id} ${task.objective} (${task.status})`;
}

export const assign_task: ApiToolDefinition = {
  ...assignTaskDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const owner = await resolveWorkActor(scope, args.owner);
    const task = await assignTask(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      owner,
      scope.caller,
    );

    return {
      status: "success",
      name: "assign_task",
      content: `Assigned: ${describeTask(task)}`,
      data: { task },
    };
  },
};

export const post_update: ApiToolDefinition = {
  ...postUpdateDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const post = await commentOnTask(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      readText(args.body),
      scope.caller,
    );

    return {
      status: "success",
      name: "post_update",
      content: "Posted to the task thread.",
      data: { post },
    };
  },
};

export const block_task: ApiToolDefinition = {
  ...blockTaskDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const unblocker = await resolveWorkActor(scope, args.unblocker);
    const task = await blockTask(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      readText(args.reason),
      unblocker,
      scope.caller,
    );

    return {
      status: "success",
      name: "block_task",
      content: `Blocked: ${describeTask(task)}`,
      data: { task },
    };
  },
};

export const request_review: ApiToolDefinition = {
  ...requestReviewDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const reviewer = await resolveWorkActor(scope, args.reviewer);
    const task = await requestReview(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      reviewer,
      readText(args.note) || null,
      scope.caller,
    );

    return {
      status: "success",
      name: "request_review",
      content: `Sent for review: ${describeTask(task)}`,
      data: { task },
    };
  },
};

export const review_task: ApiToolDefinition = {
  ...reviewTaskDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const task = await reviewTask(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      args.decision === "accept" ? "accept" : "changes",
      readText(args.note),
      scope.caller,
    );

    return {
      status: "success",
      name: "review_task",
      content: `Reviewed: ${describeTask(task)}`,
      data: { task },
    };
  },
};

export const escalate: ApiToolDefinition = {
  ...escalateDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const task = await escalateTask(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      readText(args.reason),
      scope.caller,
    );

    return {
      status: "success",
      name: "escalate",
      content: `Escalated: ${describeTask(task)}`,
      data: { task },
    };
  },
};

export const raise_case: ApiToolDefinition = {
  ...raiseCaseDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const origin = readText(args.raisedFromTaskId);
    const originTask = origin
      ? await scope.context.repositories
          .get(ProjectTaskRepository)
          .getTaskByReference(scope.projectId, origin)
      : null;
    const input = raiseCaseSchema.parse({
      title: readText(args.title),
      description: readText(args.description) || null,
      priority: projectTaskPrioritySchema.safeParse(args.priority).data ?? "none",
      raisedFromTaskId: originTask?.id ?? null,
    });
    const task = await raiseCase(scope.context, scope.projectId, input, scope.caller);

    return {
      status: "success",
      name: "raise_case",
      content: `Raised case ${describeTask(task)} and sent it to Triage.`,
      data: { task },
    };
  },
};

export const propose_hire: ApiToolDefinition = {
  ...proposeHireDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const manager = readText(args.reportsTo)
      ? await resolveWorkActor(scope, args.reportsTo)
      : scope.caller.actor;
    const heartbeatHours = typeof args.heartbeatHours === "number" ? args.heartbeatHours : null;
    const input = proposeHireSchema.parse({
      name: readText(args.name),
      title: readText(args.title),
      roleSlug: readText(args.roleSlug) || null,
      jobDescription: readText(args.jobDescription) || null,
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
      reason: readText(args.reason),
    });
    const proposed = await proposeHire(scope.context, scope.workspaceId, input, {
      teammateId: scope.caller.actor.type === "teammate" ? scope.caller.actor.id : null,
    });

    return {
      status: "success",
      name: "propose_hire",
      content: `Proposed hiring ${proposed.name} as ${proposed.title}. A person decides in Inbox.`,
      data: { teammate: proposed },
    };
  },
};

export const answer_standup: ApiToolDefinition = {
  ...answerStandupDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const task = await scope.context.repositories
      .get(ProjectTaskRepository)
      .getTaskByReference(scope.projectId, readText(args.taskId));
    const questions = task?.details.standup?.questions ?? [];
    const answers = readTrimmedStringArray(args.answers);
    const updated = await answerStandup(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      { answers: questions.map((question, index) => ({ question, answer: answers[index] ?? "" })) },
      scope.caller,
    );

    return {
      status: "success",
      name: "answer_standup",
      content: "Answered standup.",
      data: { task: updated },
    };
  },
};

export const summarise_standup: ApiToolDefinition = {
  ...summariseStandupDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const task = await summariseStandup(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      readText(args.summary),
      scope.caller,
    );

    return {
      status: "success",
      name: "summarise_standup",
      content: "Standup closed.",
      data: { task },
    };
  },
};

export const propose_setup_plan: ApiToolDefinition = {
  ...proposeSetupPlanDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const plan = setupPlanSchema.safeParse(args.plan);

    if (!plan.success) {
      throw new Error(`The setup plan is not valid: ${plan.error.message}`);
    }

    const state = await proposeSetupPlan(scope.context, scope.workspaceId, plan.data, scope.caller);

    return {
      status: "success",
      name: "propose_setup_plan",
      content: `Setup plan revision ${state.revision} is waiting for approval in Inbox.`,
      data: { setup: state },
    };
  },
};

export const draft_reply: ApiToolDefinition = {
  ...draftReplyDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const task = await draftCaseReply(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      readText(args.body),
      scope.caller,
    );

    return {
      status: "success",
      name: "draft_reply",
      content: `Drafted a reply on ${task.key ?? task.id}. A person sends it.`,
      data: { task },
    };
  },
};

export const answer_questions: ApiToolDefinition = {
  ...answerQuestionsDescriptor,
  execute: async (args, toolContext) => {
    const scope = await resolveWorkToolScope(toolContext.request);
    const answers = z.array(userQuestionAnswerSchema).min(1).parse(args.answers);
    const task = await answerReportQuestions(
      scope.context,
      scope.projectId,
      readText(args.taskId),
      answers,
      scope.caller,
    );

    return {
      status: "success",
      name: "answer_questions",
      content: `Answered the questions on ${task.key ?? task.id}. Its owner carries on.`,
      data: { task },
    };
  },
};

export const WORK_TOOLS = [
  assign_task,
  post_update,
  block_task,
  request_review,
  review_task,
  escalate,
  raise_case,
  propose_hire,
  answer_standup,
  summarise_standup,
  propose_setup_plan,
  draft_reply,
  answer_questions,
];
