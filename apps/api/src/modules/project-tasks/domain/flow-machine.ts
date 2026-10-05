import {
  findProjectFlowNode,
  projectFlowExecutionSchema,
  type NativeRecordValues,
  type NativeRecordValue,
  type ProjectFlow,
  type ProjectFlowCondition,
  type ProjectFlowExecution,
  type ProjectFlowNode,
  type ProjectFlowValueBinding,
} from "@ngriffin_uk/polychat-schemas";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

type WaitNode = Extract<ProjectFlowNode, { type: "agent" | "function" | "human_wait" | "timer" }>;

export type ProjectFlowStep =
  | { kind: "advance"; from: ProjectFlowNode; execution: ProjectFlowExecution }
  | { kind: "wait"; node: WaitNode; execution: ProjectFlowExecution }
  | {
      kind: "finished";
      node: Extract<ProjectFlowNode, { type: "end" }>;
      execution: ProjectFlowExecution;
    };

export function resolveProjectFlowValue(
  binding: ProjectFlowValueBinding,
  values: NativeRecordValues,
): NativeRecordValue {
  if (binding === null) {
    return null;
  }

  if (typeof binding === "string" || typeof binding === "number" || typeof binding === "boolean") {
    return binding;
  }

  const value = values[binding.variable];

  if (value === undefined) {
    throw new AssistantError(
      `Flow variable ${binding.variable} is missing`,
      ErrorType.PARAMS_ERROR,
      409,
    );
  }

  return value;
}

export function evaluateProjectFlowCondition(
  condition: ProjectFlowCondition,
  values: NativeRecordValues,
): boolean {
  const value = values[condition.variable];

  if (condition.operator === "exists") {
    return value !== undefined && value !== null;
  }

  if (value === undefined) {
    return false;
  }

  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "ne":
      return value !== condition.value;
    case "contains":
      return (
        typeof value === "string" &&
        typeof condition.value === "string" &&
        value.includes(condition.value)
      );
    case "gt":
      return (
        typeof value === "number" && typeof condition.value === "number" && value > condition.value
      );
    case "gte":
      return (
        typeof value === "number" && typeof condition.value === "number" && value >= condition.value
      );
    case "lt":
      return (
        typeof value === "number" && typeof condition.value === "number" && value < condition.value
      );
    case "lte":
      return (
        typeof value === "number" && typeof condition.value === "number" && value <= condition.value
      );
  }
}

export function initialProjectFlowExecution(
  flow: ProjectFlow,
  nodeId = flow.entryNodeId,
): ProjectFlowExecution {
  if (!findProjectFlowNode(flow, nodeId)) {
    throw new AssistantError("The flow entry node is missing", ErrorType.CONFLICT_ERROR, 409);
  }

  return projectFlowExecutionSchema.parse({ nodeId, steps: 0 });
}

export function completeProjectFlowWait(
  execution: ProjectFlowExecution,
  nextNodeId: string,
  values: NativeRecordValues = {},
): ProjectFlowExecution {
  const parsed = projectFlowExecutionSchema.safeParse({
    ...execution,
    nodeId: nextNodeId,
    waitId: null,
    values: { ...execution.values, ...values },
  });

  if (!parsed.success) {
    throw new AssistantError(
      parsed.error.issues[0]?.message ?? "These values exceed the flow limits",
      ErrorType.PARAMS_ERROR,
      400,
    );
  }

  return parsed.data;
}

export function stepProjectFlow(
  flow: ProjectFlow,
  previous: ProjectFlowExecution,
): ProjectFlowStep {
  if (previous.waitId) {
    throw new AssistantError(
      "Resolve the current named wait before advancing",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }

  if (previous.steps >= flow.maxSteps) {
    throw new AssistantError("The flow reached its step limit", ErrorType.CONFLICT_ERROR, 409);
  }

  const node = findProjectFlowNode(flow, previous.nodeId);

  if (!node) {
    throw new AssistantError("The current flow node is missing", ErrorType.CONFLICT_ERROR, 409);
  }

  const execution = projectFlowExecutionSchema.parse({ ...previous, steps: previous.steps + 1 });

  switch (node.type) {
    case "decision":
      return {
        kind: "advance",
        from: node,
        execution: {
          ...execution,
          nodeId: evaluateProjectFlowCondition(node.condition, execution.values)
            ? node.onTrue
            : node.onFalse,
        },
      };
    case "loop": {
      const count = execution.iterations[node.id] ?? 0;
      const enter = count < node.maxIterations;

      return {
        kind: "advance",
        from: node,
        execution: {
          ...execution,
          nodeId: enter ? node.body : node.exit,
          iterations: { ...execution.iterations, [node.id]: enter ? count + 1 : count },
        },
      };
    }

    case "end":
      return { kind: "finished", node, execution };
    default:
      return { kind: "wait", node, execution };
  }
}
