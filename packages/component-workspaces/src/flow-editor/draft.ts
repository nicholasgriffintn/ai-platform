import {
  createAdhocProjectFlow,
  type ProjectFlow,
  type ProjectFlowNode,
} from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import { FLOW_NODE_LABELS } from "../flow-node-presentation";

export function newFlowNode(type: ProjectFlowNode["type"], next: string): ProjectFlowNode {
  const base = { id: `step-${generateId().slice(0, 8)}`, name: FLOW_NODE_LABELS[type] };

  switch (type) {
    case "agent":
      return {
        ...base,
        type,
        instructions: null,
        teammateId: null,
        skillIds: [],
        mode: null,
        requiresApprovalFor: [],
        next,
      };
    case "function":
      return { ...base, type, operation: { kind: "set_values", values: {} }, next };
    case "decision":
      return {
        ...base,
        type,
        condition: { operator: "exists", variable: "result" },
        onTrue: next,
        onFalse: next,
      };
    case "loop":
      return { ...base, type, maxIterations: 2, body: next, exit: next };
    case "human_wait":
      return {
        ...base,
        type,
        prompt: "Review the work before continuing.",
        assigneeUserId: null,
        fields: [],
        onAccepted: next,
        onRejected: next,
      };
    case "timer":
      return { ...base, type, seconds: 60, next };
    case "end":
      return { ...base, type, status: "done" };
  }
}

export function initialFlowDraft(flow: ProjectFlow | null): ProjectFlow {
  return structuredClone(flow ?? createAdhocProjectFlow());
}

export function nextFlowBindingKey(values: Record<string, unknown>): string {
  let index = Object.keys(values).length + 1;

  while (Object.hasOwn(values, `value_${index}`)) {
    index += 1;
  }

  return `value_${index}`;
}
