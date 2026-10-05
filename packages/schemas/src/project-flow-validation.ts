export interface ProjectFlowValidationNode {
  id: string;
  type: "agent" | "function" | "decision" | "loop" | "human_wait" | "timer" | "end";
  next?: string;
  onTrue?: string;
  onFalse?: string;
  body?: string;
  exit?: string;
  onAccepted?: string;
  onRejected?: string;
}

export function projectFlowNodeTargets(node: ProjectFlowValidationNode): string[] {
  switch (node.type) {
    case "decision":
      return [node.onTrue, node.onFalse].filter((id): id is string => Boolean(id));
    case "loop":
      return [node.body, node.exit].filter((id): id is string => Boolean(id));
    case "human_wait":
      return [node.onAccepted, node.onRejected].filter((id): id is string => Boolean(id));
    case "end":
      return [];
    default:
      return node.next ? [node.next] : [];
  }
}

export function validateProjectFlowGraph(flow: {
  entryNodeId: string;
  nodes: readonly ProjectFlowValidationNode[];
}): string | null {
  const byId = new Map(flow.nodes.map((node) => [node.id, node]));

  if (byId.size !== flow.nodes.length) {
    return "Node IDs must be unique";
  }

  if (!byId.has(flow.entryNodeId)) {
    return "Choose an existing entry node";
  }

  if (!flow.nodes.some((node) => node.type === "end")) {
    return "Add an end node";
  }

  for (const node of flow.nodes) {
    if (projectFlowNodeTargets(node).some((target) => !byId.has(target))) {
      return `Node ${node.id} references a missing target`;
    }
  }

  const reachable = new Set<string>();
  const visit = (id: string) => {
    if (reachable.has(id)) {
      return;
    }

    reachable.add(id);
    const node = byId.get(id);

    if (node) {
      for (const target of projectFlowNodeTargets(node)) {
        visit(target);
      }
    }
  };

  visit(flow.entryNodeId);
  if (reachable.size !== byId.size) {
    return "Connect every node to the entry node";
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const hasUnboundedCycle = (id: string): boolean => {
    if (visiting.has(id)) {
      return true;
    }

    if (visited.has(id)) {
      return false;
    }

    visiting.add(id);
    const node = byId.get(id);
    const targets =
      node?.type === "loop"
        ? node.exit
          ? [node.exit]
          : []
        : node
          ? projectFlowNodeTargets(node)
          : [];

    if (targets.some(hasUnboundedCycle)) {
      return true;
    }

    visiting.delete(id);
    visited.add(id);

    return false;
  };

  if (flow.nodes.some((node) => hasUnboundedCycle(node.id))) {
    return "Every cycle must pass through a bounded loop's body edge";
  }

  return null;
}

import type { ProjectFlowNode, ProjectRecordTrigger } from "./project-flow.js";

export function validateProjectFlowValueNames(flow: {
  nodes: readonly ProjectFlowNode[];
  recordTriggers: readonly ProjectRecordTrigger[];
}): string | null {
  const names = new Set<string>();

  for (const node of flow.nodes) {
    if (node.type === "agent" && node.outputKey) {
      names.add(node.outputKey);
    }

    if (node.type === "human_wait") {
      for (const field of node.fields) {
        names.add(field.id);
      }
    }

    if (node.type === "function") {
      if (node.operation.kind === "set_values") {
        for (const key of Object.keys(node.operation.values)) {
          names.add(key);
        }
      }

      if (node.operation.kind === "read_record") {
        for (const key of Object.keys(node.operation.saveFields)) {
          names.add(key);
        }
      }

      if (node.operation.kind === "create_record" && node.operation.outputIdKey) {
        names.add(node.operation.outputIdKey);
      }
    }
  }

  for (const trigger of flow.recordTriggers) {
    names.add("record_id");
    names.add("record_operation");
    for (const key of Object.keys(trigger.saveFields)) {
      names.add(key);
    }
  }

  return names.size > 64
    ? "Use at most 64 distinct flow value names across steps and record triggers"
    : null;
}
