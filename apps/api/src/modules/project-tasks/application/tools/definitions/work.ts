import { jsonSchemaToZod } from "@ngriffin_uk/polychat-library-tools";
import {
  PROJECT_TASK_PRIORITIES,
  setupPlanSchema,
  userQuestionAnswerSchema,
} from "@ngriffin_uk/polychat-schemas";
import z from "zod/v4";

import type { FunctionToolDescriptor } from "~/types/functions";

const taskIdProperty = {
  type: "string",
  description: "The task key, such as BIL-41, or its id.",
};
const actorProperty = {
  type: "string",
  description:
    "Who it is for: a teammate's name, or a person's name or email address. Use 'me' for the person you work for.",
};

export const assign_task: FunctionToolDescriptor = {
  name: "assign_task",
  description:
    "Hand a task to a teammate or a person. A teammate wakes and starts on it straight away, using the same person's authority as you. Use it to delegate work down your team instead of doing someone else's job.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "assign_task", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: { taskId: taskIdProperty, owner: actorProperty },
    required: ["taskId", "owner"],
    additionalProperties: false,
  }),
};

export const post_update: FunctionToolDescriptor = {
  name: "post_update",
  description:
    "Post progress to a task's thread: what happened, where it stands, what's next and any links. Mention teammates with @name to wake them. Every run should end with an update, a status change or a named blocker.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      body: { type: "string", description: "The update, written for people to read." },
    },
    required: ["taskId", "body"],
    additionalProperties: false,
  }),
};

export const block_task: FunctionToolDescriptor = {
  name: "block_task",
  description:
    "Mark a task blocked and name who can unblock it and what they need to do. Use it instead of guessing when you need a decision, access or another piece of work.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "block_task", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      reason: { type: "string", description: "What is needed to carry on." },
      unblocker: actorProperty,
    },
    required: ["taskId", "reason", "unblocker"],
    additionalProperties: false,
  }),
};

export const request_review: FunctionToolDescriptor = {
  name: "request_review",
  description:
    "Send a task to a reviewer, a teammate or a person. The reviewer accepts the work or asks for changes. After three rounds between teammates the task goes to a person.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "request_review", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      reviewer: actorProperty,
      note: { type: "string", description: "What the reviewer should check." },
    },
    required: ["taskId", "reviewer"],
    additionalProperties: false,
  }),
};

export const review_task: FunctionToolDescriptor = {
  name: "review_task",
  description:
    "Review a task you were asked to review. Accept it when its evidence meets the acceptance criteria, or ask for changes with a clear note. You can only review tasks that name you as reviewer.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "review_task", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      decision: { type: "string", enum: ["accept", "changes"] },
      note: { type: "string", description: "Why you accepted, or what to change." },
    },
    required: ["taskId", "decision", "note"],
    additionalProperties: false,
  }),
};

export const escalate: FunctionToolDescriptor = {
  name: "escalate",
  description:
    "Escalate a task up your reporting line when you need a decision, a hire, spend or a requirement clarified. It goes to your manager, or to the person you work for when you have none.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "escalate", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      reason: { type: "string", description: "The decision or help you need." },
    },
    required: ["taskId", "reason"],
    additionalProperties: false,
  }),
};

export const raise_case: FunctionToolDescriptor = {
  name: "raise_case",
  description:
    "Raise a case for a problem you found outside your own task, such as a bug or a wrong figure. It goes to the project's Triage, linked to the task you were working on. Do not fix work outside your task yourself.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "write" },
  intentEvidence: (input) => ({ operation: "raise_case", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      title: { type: "string", description: "The problem in one line." },
      description: { type: "string", description: "What you saw, where, and why it matters." },
      priority: { type: "string", enum: [...PROJECT_TASK_PRIORITIES] },
      raisedFromTaskId: taskIdProperty,
    },
    required: ["title"],
    additionalProperties: false,
  }),
};

export const propose_hire: FunctionToolDescriptor = {
  name: "propose_hire",
  description:
    "Propose hiring a new teammate when the team lacks a skill. A person approves or rejects it in Inbox before the teammate exists. Give a reason, a manager and a monthly budget in credits.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  intentEvidence: (input) => ({ operation: "propose_hire", ...input }),
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      name: { type: "string" },
      title: { type: "string", description: "Job title, such as Analyst." },
      roleSlug: { type: "string", description: "A built-in role slug, if one fits." },
      jobDescription: { type: "string", description: "The job, when no built-in role fits." },
      reportsTo: { type: "string", description: "Manager's name. Leave out to report to you." },
      monthlyCredits: { type: "number", description: "Monthly budget in credits." },
      heartbeatHours: { type: "number", description: "Wake every this many hours, if at all." },
      reason: { type: "string", description: "Why the team needs this hire." },
    },
    required: ["name", "title", "reason"],
    additionalProperties: false,
  }),
};

export const answer_standup: FunctionToolDescriptor = {
  name: "answer_standup",
  description:
    "Answer today's standup with your own task activity since the last one. Never invent progress: if nothing moved, say so.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      answers: {
        type: "array",
        description: "One answer per standup question, in order.",
        items: { type: "string" },
      },
    },
    required: ["taskId", "answers"],
    additionalProperties: false,
  }),
};

export const summarise_standup: FunctionToolDescriptor = {
  name: "summarise_standup",
  description:
    "Close a standup with a short summary for the team: who moved what, what is next and what is blocked. Do the follow-ups first with the other tools.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      summary: { type: "string" },
    },
    required: ["taskId", "summary"],
    additionalProperties: false,
  }),
};

export const propose_setup_plan: FunctionToolDescriptor = {
  name: "propose_setup_plan",
  description:
    "Propose the workspace setup plan for a person to approve: mission, initiatives, projects, team, budgets, wake rules, routines, first tasks and the connections people need to make. Nothing is created until the plan is approved. Each call replaces the previous revision. Keys are short labels you choose so items can refer to each other: a project names its initiative key, a teammate names the projects it works on and the teammate key it reports to ('lead' for you), and a task names its project and owner keys. Task prefixes are 2-5 capital letters. Budgets are in credit micros.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: z.object({ plan: setupPlanSchema }),
};

export const draft_reply: FunctionToolDescriptor = {
  name: "draft_reply",
  description:
    "Draft a reply to the person who raised a case through a channel or email. It is not sent: a person reads it and sends it from the case.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      taskId: taskIdProperty,
      body: { type: "string", description: "The reply, written to the requester." },
    },
    required: ["taskId", "body"],
    additionalProperties: false,
  }),
};

export const answer_questions: FunctionToolDescriptor = {
  name: "answer_questions",
  description:
    "Answer the pending questions on a task owned by a teammate who reports to you, so it carries on without waiting for a person. Answer every question, using the mission, plans, other tasks and your memory. When only the person can answer, escalate instead of guessing.",
  type: "normal",
  permissions: ["write"],
  effects: { effectClass: "draft" },
  inputSchema: z.object({
    taskId: z.string().min(1).describe(taskIdProperty.description),
    answers: z
      .array(userQuestionAnswerSchema)
      .min(1)
      .describe("One answer per pending question, using the question ids from the brief."),
  }),
};
