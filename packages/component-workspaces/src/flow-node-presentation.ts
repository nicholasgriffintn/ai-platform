import type { ProjectFlowNode } from "@ngriffin_uk/polychat-schemas";

export const FLOW_NODE_LABELS: Record<ProjectFlowNode["type"], string> = {
  agent: "Teammate",
  function: "Record action",
  decision: "Decision",
  loop: "Repeat",
  human_wait: "Review",
  timer: "Delay",
  end: "Finish",
};

export function flowNodeConnections(node: ProjectFlowNode): { label: string; target: string }[] {
  switch (node.type) {
    case "decision":
      return [
        { label: "If true", target: node.onTrue },
        { label: "Otherwise", target: node.onFalse },
      ];
    case "loop":
      return [
        { label: "Repeat", target: node.body },
        { label: "Afterwards", target: node.exit },
      ];
    case "human_wait":
      return [
        { label: "Accepted", target: node.onAccepted },
        { label: "Rejected", target: node.onRejected },
      ];
    case "end":
      return [];
    default:
      return [{ label: "Next", target: node.next }];
  }
}
