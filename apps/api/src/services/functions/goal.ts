import {
  goalEvidenceEntrySchema,
  type Goal,
  type GoalEvidenceEntry,
  type GoalMarkerEvent,
} from "@ngriffin_uk/polychat-schemas";

import { recordGoalMarker } from "~/services/goals/goalMarker";
import { GoalService } from "~/services/goals/GoalService";

import type { ApiToolDefinition } from "../../types/functions";
import { jsonSchemaToZod } from "../../utils/jsonSchema";

function resolveGoalService(context: any): GoalService | null {
  const repositories = context?.request?.context?.repositories;

  return repositories?.goals ? new GoalService(repositories.goals) : null;
}

function resolveCompletionId(context: any): string | undefined {
  return context?.request?.request?.completion_id || context?.completionId || undefined;
}

/**
 * A delegated sub-agent works inside the delegating thread's conversation, so
 * it can see the goal but must not be able to declare it done on work it did
 * not do. Only the owning thread completes its own goal.
 */
function isDelegatedRun(context: any): boolean {
  const stack = context?.request?.request?.delegation_stack;

  return Array.isArray(stack) && stack.length > 0;
}

async function markGoal(
  context: any,
  completionId: string,
  goal: Goal,
  event: GoalMarkerEvent,
): Promise<void> {
  const conversationManager = context?.conversationManager;

  if (!conversationManager) {
    return;
  }

  await recordGoalMarker({ conversationManager, completionId, goal, event });
}

async function hasAnsweredSince(
  context: any,
  completionId: string,
  goalCreatedAt: string,
): Promise<boolean> {
  const messages =
    await context?.request?.context?.repositories?.messages?.getConversationMessages(completionId);

  if (!Array.isArray(messages)) {
    return true;
  }

  const goalCreated = Date.parse(goalCreatedAt);

  return messages.some((message: any) => {
    if (message?.role !== "assistant") {
      return false;
    }

    const at = Number(message.timestamp);

    if (Number.isFinite(goalCreated) && Number.isFinite(at) && at < goalCreated) {
      return false;
    }

    return typeof message.content === "string"
      ? message.content.trim().length > 0
      : Array.isArray(message.content) && message.content.length > 0;
  });
}

function parseEvidence(rawEvidence: unknown): GoalEvidenceEntry[] {
  if (!Array.isArray(rawEvidence)) {
    return [];
  }

  return rawEvidence.flatMap((entry) => {
    const parsed = goalEvidenceEntrySchema.safeParse(entry);

    return parsed.success ? [parsed.data] : [];
  });
}

export const set_goal: ApiToolDefinition = {
  name: "set_goal",
  description:
    "Set a persistent objective for this conversation when the user asks you to keep working until something is true. The objective survives turns and is only complete once the evidence supports it.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      objective: {
        type: "string",
        description:
          "What should be true when the work is done, stated so it can be checked against evidence.",
      },
    },
    required: ["objective"],
  }),
  type: "premium",
  costPerCall: 0,
  permissions: ["write"],
  execute: async (args, context) => {
    const req = context.request;
    const service = resolveGoalService(context);
    const user = req.user;
    const completionId = resolveCompletionId(context);

    if (!service || !user?.id || !completionId) {
      return {
        status: "error",
        name: "set_goal",
        content: "Goals are not available for this conversation",
        data: {},
      };
    }

    const goal = await service.setGoal({
      owner: { conversationId: completionId },
      user,
      objective: args.objective,
      source: "model",
    });

    await markGoal(context, completionId, goal, "set");

    return {
      status: "success",
      name: "set_goal",
      content: `Goal set: ${goal.objective}`,
      data: { goal },
    };
  },
};

export const complete_goal: ApiToolDefinition = {
  name: "complete_goal",
  description:
    "Mark the active goal complete. Only call this once the objective is satisfied and you can cite the evidence for it. An empty or entirely blocked ledger is a blocker report, not a completion.",
  inputSchema: jsonSchemaToZod({
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "What was achieved, and anything still outstanding.",
      },
      evidence: {
        type: "array",
        minItems: 1,
        description: "One entry per claim the objective depends on.",
        items: {
          type: "object",
          properties: {
            claim: { type: "string", description: "The part of the objective this speaks to." },
            route: {
              type: "string",
              description: "How it was established: what was run, read, or changed.",
            },
            evidence_surface: {
              type: "string",
              description: "Where the evidence lives: a tool result, run id, file, or source.",
            },
            status: {
              type: "string",
              enum: ["confirmed", "approximate", "supporting", "blocked"],
              description: "How strongly the evidence supports the claim.",
            },
            remaining_uncertainty: {
              type: "string",
              description: "What is still unproven about this claim.",
            },
          },
          required: ["claim", "route", "evidence_surface", "status"],
        },
      },
    },
    required: ["summary", "evidence"],
  }),
  type: "premium",
  costPerCall: 0,
  permissions: ["write"],
  execute: async (args, context) => {
    const service = resolveGoalService(context);
    const completionId = resolveCompletionId(context);

    if (!service || !completionId) {
      return {
        status: "error",
        name: "complete_goal",
        content: "Goals are not available for this conversation",
        data: {},
      };
    }

    if (isDelegatedRun(context)) {
      return {
        status: "error",
        name: "complete_goal",
        content:
          "A delegated agent cannot complete the goal. Report your findings back to the thread that delegated to you, and let it audit the objective.",
        data: {},
      };
    }

    const active = await service.getActiveGoal({ conversationId: completionId });

    if (!active) {
      return {
        status: "error",
        name: "complete_goal",
        content: "There is no active goal to complete",
        data: {},
      };
    }

    if (!(await hasAnsweredSince(context, completionId, active.created_at))) {
      return {
        status: "error",
        name: "complete_goal",
        content:
          "Nothing has been produced for this objective yet. Give the user your answer in this turn first, then call complete_goal citing that answer as evidence.",
        data: {},
      };
    }

    const evidence = parseEvidence(args.evidence);

    if (evidence.length === 0) {
      return {
        status: "error",
        name: "complete_goal",
        content:
          "Completing a goal requires an evidence ledger. Give one entry per claim, naming how it was established and where the evidence lives.",
        data: {},
      };
    }

    const goal = await service.completeGoal({
      goalId: active.id,
      evidence,
      summary: args.summary,
    });

    return {
      status: "success",
      name: "complete_goal",
      content:
        goal.status === "blocked"
          ? `Goal recorded as blocked: ${args.summary}`
          : `Goal completed: ${goal.objective}`,
      data: { goal },
    };
  },
};
