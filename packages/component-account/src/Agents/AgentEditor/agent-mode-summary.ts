import type { AgentMode, ToolPermission } from "@ngriffin_uk/polychat-schemas";
import { AGENT_MODE_CONFIGS, agentModeSchema } from "@ngriffin_uk/polychat-schemas";

export const AGENT_MODES: AgentMode[] = [...agentModeSchema.options];

const MODE_LABELS: Record<AgentMode, string> = {
  chat: "Chat",
  plan: "Plan",
  build: "Build",
  explore: "Explore",
};

const PERMISSION_LABELS: Record<ToolPermission, string> = {
  read: "reading",
  reasoning: "reasoning",
  network: "network calls",
  write: "writes",
  sandbox: "sandbox runs",
  orchestration: "orchestration",
  human: "asking you",
  delegate: "delegation",
};

const listFormatter = new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" });

function describePermissions(permissions: readonly ToolPermission[]): string {
  return listFormatter.format(permissions.map((permission) => PERMISSION_LABELS[permission]));
}

export function getAgentModeLabel(mode: AgentMode): string {
  return MODE_LABELS[mode];
}

export function describeAgentMode(mode: AgentMode): string {
  const config = AGENT_MODE_CONFIGS[mode];
  const clauses = [`runs up to ${config.maxSteps} steps`];

  if (config.deniedPermissions.length > 0) {
    clauses.push(`blocks ${describePermissions(config.deniedPermissions)}`);
  }

  if (config.requiresApprovalFor.length > 0) {
    clauses.push(`asks before ${describePermissions(config.requiresApprovalFor)}`);
  }

  if (config.deniedPermissions.length === 0 && config.requiresApprovalFor.length === 0) {
    clauses.push("leaves every tool permission open");
  }

  return `${listFormatter.format(clauses)}.`;
}
