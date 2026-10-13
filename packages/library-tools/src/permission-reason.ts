import type { ToolPolicyContext } from "@ngriffin_uk/polychat-library-policy";
import type { AgentMode } from "@ngriffin_uk/polychat-schemas";

export function toolDenialReason(
  policyIds: readonly string[],
  context: ToolPolicyContext,
  mode: AgentMode,
): string {
  const reasons: Record<string, string> = {
    "tool.premium:0": "This tool requires a premium subscription",
    "tool.byok:0": "This tool requires a signed-in user",
    "tool.teammate:0": `Tool "${context.toolName}" is not available to this teammate`,
    "tool.mode.denied:0": `Tool "${context.toolName}" is not allowed in ${mode} mode`,
    "tool.mode.enabled:0": `Tool "${context.toolName}" is not enabled in ${mode} mode`,
    "tool.mode.permissions.denied:0": `Tool "${context.toolName}" is blocked in ${mode} mode (${context.permissions.filter((permission) => context.modeDeniedPermissions.includes(permission)).join(", ")})`,
    "tool.mode.permissions.allowed:0": `Tool "${context.toolName}" is not compatible with ${mode} mode (${context.permissions.filter((permission) => !context.modeAllowedPermissions.includes(permission)).join(", ")})`,
    "tool.autonomy.observer:0": `Tool "${context.toolName}" would change something (${context.effectClass}), and this teammate is set to observe only`,
  };

  return (
    Object.entries(reasons).find(([id]) => policyIds.includes(id))?.[1] ??
    "Tool access could not be authorised"
  );
}

const FLOOR_EFFECT_DESCRIPTIONS: Readonly<Record<string, string>> = {
  external_send: "sends to people outside Polychat",
  spend: "spends money",
  destructive: "deletes something for good",
  credential: "handles credentials",
  data_export: "moves data out of Polychat",
};

export function toolApprovalReason(
  policyIds: readonly string[],
  context: ToolPolicyContext,
  mode: AgentMode,
  approvalPermissions: readonly string[],
): string {
  if (policyIds.includes("tool.autonomy.floor:0")) {
    const description = FLOOR_EFFECT_DESCRIPTIONS[context.effectClass] ?? "has a lasting effect";

    return `Tool "${context.toolName}" ${description}, which always needs your approval`;
  }

  if (policyIds.includes("tool.autonomy.assistant:0")) {
    return `Tool "${context.toolName}" writes outside this conversation, so it needs your approval at the assistant level`;
  }

  return `Tool "${context.toolName}" requires approval in ${mode} mode (${approvalPermissions.join(", ")})`;
}
