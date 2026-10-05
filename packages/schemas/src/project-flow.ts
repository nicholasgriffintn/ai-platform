import z from "zod/v4";

import { agentModeSchema, toolPermissionSchema } from "./agent-modes.js";
import {
  nativeRecordColumnIdSchema,
  nativeRecordColumnSchema,
  nativeRecordValueSchema,
  nativeRecordValuesSchema,
  nativeRecordFilterSchema,
} from "./native-records.js";
import {
  validateProjectFlowGraph,
  validateProjectFlowValueNames,
} from "./project-flow-validation.js";

export const PROJECT_FLOW_MAX_NODES = 64;
export const PROJECT_FLOW_MAX_STEPS = 1000;
export const projectFlowNodeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9_-]*$/);
const fields = { id: projectFlowNodeIdSchema, name: z.string().trim().min(1).max(120) };

export const projectFlowValueBindingSchema = z.union([
  nativeRecordValueSchema,
  z.object({ variable: nativeRecordColumnIdSchema }).strict(),
]);
export type ProjectFlowValueBinding = z.infer<typeof projectFlowValueBindingSchema>;
const bindings = z
  .record(nativeRecordColumnIdSchema, projectFlowValueBindingSchema)
  .refine((values) => Object.keys(values).length <= 64, "Use at most 64 values");

export const projectFlowFunctionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("set_values"), values: bindings }).strict(),
  z
    .object({
      kind: z.literal("read_record"),
      tableId: z.string().min(1),
      recordId: projectFlowValueBindingSchema,
      saveFields: z
        .record(nativeRecordColumnIdSchema, nativeRecordColumnIdSchema)
        .refine((values) => Object.keys(values).length <= 64, "Read at most 64 fields"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("create_record"),
      tableId: z.string().min(1),
      values: bindings,
      outputIdKey: nativeRecordColumnIdSchema.optional(),
    })
    .strict(),
]);
export type ProjectFlowFunction = z.infer<typeof projectFlowFunctionSchema>;

export const projectFlowConditionSchema = z.discriminatedUnion("operator", [
  z
    .object({
      operator: z.enum(["eq", "ne", "contains", "gt", "gte", "lt", "lte"]),
      variable: nativeRecordColumnIdSchema,
      value: nativeRecordValueSchema,
    })
    .strict(),
  z.object({ operator: z.literal("exists"), variable: nativeRecordColumnIdSchema }).strict(),
]);
export type ProjectFlowCondition = z.infer<typeof projectFlowConditionSchema>;

export const projectFlowAgentConfigSchema = z
  .object({
    ...fields,
    instructions: z.string().trim().max(2000).nullable().default(null),
    teammateId: z.string().trim().min(1).nullable().default(null),
    skillIds: z.array(z.string().trim().min(1)).max(64).default([]),
    mode: agentModeSchema.nullable().default(null),
    requiresApprovalFor: z.array(toolPermissionSchema).default([]),
  })
  .strict()
  .refine(
    (node) => new Set(node.skillIds).size === node.skillIds.length,
    "Node skills must be unique",
  );
export type ProjectFlowAgentConfig = z.infer<typeof projectFlowAgentConfigSchema>;

export const projectFlowAgentNodeSchema = projectFlowAgentConfigSchema.safeExtend({
  type: z.literal("agent"),
  next: projectFlowNodeIdSchema,
  outputKey: nativeRecordColumnIdSchema.optional(),
});
export type ProjectFlowAgentNode = z.infer<typeof projectFlowAgentNodeSchema>;

export const projectFlowNodeSchema = z.discriminatedUnion("type", [
  projectFlowAgentNodeSchema,
  z
    .object({
      ...fields,
      type: z.literal("function"),
      operation: projectFlowFunctionSchema,
      next: projectFlowNodeIdSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal("decision"),
      condition: projectFlowConditionSchema,
      onTrue: projectFlowNodeIdSchema,
      onFalse: projectFlowNodeIdSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal("loop"),
      maxIterations: z.number().int().min(1).max(20),
      body: projectFlowNodeIdSchema,
      exit: projectFlowNodeIdSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal("human_wait"),
      prompt: z.string().trim().min(1).max(2000),
      assigneeUserId: z.number().int().positive().nullable().default(null),
      fields: z.array(nativeRecordColumnSchema).max(64).default([]),
      onAccepted: projectFlowNodeIdSchema,
      onRejected: projectFlowNodeIdSchema,
    })
    .strict()
    .refine(
      (node) => new Set(node.fields.map((field) => field.id)).size === node.fields.length,
      "Wait fields must be unique",
    ),
  z
    .object({
      ...fields,
      type: z.literal("timer"),
      seconds: z.number().int().min(1).max(604800),
      next: projectFlowNodeIdSchema,
    })
    .strict(),
  z
    .object({
      ...fields,
      type: z.literal("end"),
      status: z.enum(["done", "cancelled"]).default("done"),
    })
    .strict(),
]);
export type ProjectFlowNode = z.infer<typeof projectFlowNodeSchema>;

export const projectRecordTriggerSchema = z
  .object({
    id: projectFlowNodeIdSchema,
    name: z.string().trim().min(1).max(120),
    tableId: z.string().min(1),
    operations: z
      .array(z.enum(["created", "updated", "deleted"]))
      .min(1)
      .max(3),
    filters: z.array(nativeRecordFilterSchema).max(10).default([]),
    objective: z.string().trim().min(1).max(2000),
    entryNodeId: projectFlowNodeIdSchema,
    saveFields: z.record(nativeRecordColumnIdSchema, nativeRecordColumnIdSchema).default({}),
  })
  .strict()
  .refine(
    (trigger) => new Set(trigger.operations).size === trigger.operations.length,
    "Trigger operations must be unique",
  )
  .refine(
    (trigger) =>
      Object.keys(trigger.saveFields).length <= 62 &&
      !("record_id" in trigger.saveFields) &&
      !("record_operation" in trigger.saveFields),
    "Use at most 62 fields and reserve record_id and record_operation for the source event",
  );
export type ProjectRecordTrigger = z.infer<typeof projectRecordTriggerSchema>;

export const projectFlowSchema = z
  .object({
    version: z.literal(1),
    entryNodeId: projectFlowNodeIdSchema,
    nodes: z.array(projectFlowNodeSchema).min(1).max(PROJECT_FLOW_MAX_NODES),
    maxSteps: z.number().int().min(1).max(PROJECT_FLOW_MAX_STEPS).default(256),
    recordTriggers: z.array(projectRecordTriggerSchema).max(8).default([]),
  })
  .strict()
  .superRefine((flow, context) => {
    const error = validateProjectFlowGraph(flow);

    if (error) {
      context.addIssue({ code: "custom", message: error });
    }

    const valuesError = validateProjectFlowValueNames(flow);

    if (valuesError) {
      context.addIssue({ code: "custom", message: valuesError });
    }

    if (
      new Set(flow.recordTriggers.map((trigger) => trigger.id)).size !== flow.recordTriggers.length
    ) {
      context.addIssue({ code: "custom", message: "Trigger IDs must be unique" });
    }

    for (const trigger of flow.recordTriggers) {
      if (!flow.nodes.some((node) => node.id === trigger.entryNodeId)) {
        context.addIssue({
          code: "custom",
          message: "Record triggers must reference an existing node",
        });
      }
    }
  });
export type ProjectFlow = z.infer<typeof projectFlowSchema>;

export const projectFlowExecutionSchema = z
  .object({
    epoch: z.number().int().positive().default(1),
    nodeId: projectFlowNodeIdSchema,
    steps: z.number().int().min(0).max(PROJECT_FLOW_MAX_STEPS),
    iterations: z.record(projectFlowNodeIdSchema, z.number().int().min(0).max(20)).default({}),
    values: nativeRecordValuesSchema
      .refine((values) => Object.keys(values).length <= 64, "Use at most 64 flow values")
      .default({}),
    waitId: z.string().min(1).nullable().default(null),
  })
  .strict();
export type ProjectFlowExecution = z.infer<typeof projectFlowExecutionSchema>;

export const projectFlowWaitSchema = z
  .object({
    id: z.string().min(1),
    taskId: z.string().min(1),
    nodeId: projectFlowNodeIdSchema,
    step: z.number().int().positive(),
    epoch: z.number().int().positive(),
    attempt: z.number().int().positive(),
    name: z.string().min(1).max(120),
    kind: z.enum(["agent", "function", "human", "timer"]),
    status: z.enum(["pending", "dispatched", "completed", "failed", "cancelled"]),
    revision: z.number().int().positive(),
    assignedUserId: z.number().int().positive().nullable(),
    dueAt: z.string().nullable(),
    executionId: z.string().nullable(),
    payload: z.record(z.string(), z.unknown()),
    response: nativeRecordValuesSchema.nullable(),
    error: z.string().max(2000).nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    resolvedAt: z.string().nullable(),
  })
  .strict();
export type ProjectFlowWait = z.infer<typeof projectFlowWaitSchema>;

export const resolveProjectFlowWaitSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    resolution: z.enum(["accepted", "rejected"]),
    values: nativeRecordValuesSchema.default({}),
  })
  .strict();
export type ResolveProjectFlowWaitInput = z.infer<typeof resolveProjectFlowWaitSchema>;

export const projectFlowEventSchema = z
  .object({
    sequence: z.number().int().positive(),
    taskId: z.string().min(1),
    nodeId: projectFlowNodeIdSchema,
    epoch: z.number().int().positive(),
    step: z.number().int().nonnegative(),
    kind: z.enum([
      "entered",
      "waiting",
      "dispatched",
      "resumed",
      "branch",
      "iteration",
      "completed",
      "failed",
      "cancelled",
    ]),
    waitId: z.string().nullable(),
    detail: z.string().max(2000).nullable(),
    actorUserId: z.number().int().positive().nullable(),
    createdAt: z.string(),
  })
  .strict();
export type ProjectFlowEvent = z.infer<typeof projectFlowEventSchema>;

export const projectFlowHistorySchema = z
  .object({
    events: z.array(projectFlowEventSchema).max(100),
    nextCursor: z.number().int().nonnegative(),
    hasMore: z.boolean(),
  })
  .strict();
export type ProjectFlowHistory = z.infer<typeof projectFlowHistorySchema>;

export function findProjectFlowNode(
  flow: ProjectFlow | null,
  nodeId: string | null,
): ProjectFlowNode | null {
  return flow?.nodes.find((node) => node.id === nodeId) ?? null;
}

export function createSequentialProjectFlow(
  agents: readonly ProjectFlowAgentConfig[],
  reviewAfterIds: readonly string[] = [],
): ProjectFlow {
  const nodes: ProjectFlowNode[] = [];

  for (const [index, agent] of agents.entries()) {
    const next = agents[index + 1]?.id ?? "complete";
    const reviewId = `${agent.id}-review`;

    nodes.push({
      ...agent,
      type: "agent",
      next: reviewAfterIds.includes(agent.id) ? reviewId : next,
    });
    if (reviewAfterIds.includes(agent.id)) {
      nodes.push({
        id: reviewId,
        name: `Review ${agent.name}`,
        type: "human_wait",
        prompt: `Review the work from ${agent.name} before continuing.`,
        assigneeUserId: null,
        fields: [],
        onAccepted: next,
        onRejected: "cancelled",
      });
    }
  }

  nodes.push({ id: "complete", name: "Complete", type: "end", status: "done" });
  if (reviewAfterIds.length) {
    nodes.push({ id: "cancelled", name: "Rejected", type: "end", status: "cancelled" });
  }

  return projectFlowSchema.parse({
    version: 1,
    entryNodeId: agents[0]?.id ?? "complete",
    nodes,
    maxSteps: 256,
  });
}

export function createSuggestedProjectFlow(): ProjectFlow {
  const base = { teammateId: null, skillIds: [], requiresApprovalFor: [] };

  return createSequentialProjectFlow(
    [
      {
        ...base,
        id: "research",
        name: "Research",
        mode: "explore",
        instructions:
          "Gather context, constraints and sources. Hand off a brief with open questions.",
      },
      {
        ...base,
        id: "plan",
        name: "Plan",
        mode: "plan",
        instructions:
          "Define scope, acceptance criteria, dependencies and decisions before implementation.",
      },
      {
        ...base,
        id: "build",
        name: "Build",
        mode: "build",
        instructions: "Carry out the approved plan within scope and record the evidence.",
      },
      {
        ...base,
        id: "review",
        name: "Review",
        mode: "explore",
        instructions: "Check the work against its acceptance criteria and flag remaining risks.",
      },
    ],
    ["plan", "review"],
  );
}

export function createAdhocProjectFlow(): ProjectFlow {
  return createSequentialProjectFlow(
    [
      {
        id: "work",
        name: "Work",
        instructions: null,
        teammateId: null,
        skillIds: [],
        mode: null,
        requiresApprovalFor: [],
      },
    ],
    ["work"],
  );
}
