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
  };

  return (
    Object.entries(reasons).find(([id]) => policyIds.includes(id))?.[1] ??
    "Tool access could not be authorised"
  );
}
