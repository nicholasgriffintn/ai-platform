export const toolPolicies = {
  "tool.use": `permit(principal, action == Polychat::Action::"tool.use", resource);`,
  "tool.premium": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.toolType == "premium" && context.plan != "pro" };`,
  "tool.byok": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.toolType == "byok" && !context.signedIn };`,
  "tool.teammate": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.deniedTools.contains(context.toolName) };`,
  "tool.mode.denied": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.enforceMode && context.modeDeniedTools.contains(context.toolName) };`,
  "tool.mode.enabled": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.enforceMode && !context.modeAllowedTools.isEmpty() && !context.modeAllowedTools.contains(context.toolName) };`,
  "tool.mode.permissions.denied": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.enforceMode && context.permissions.containsAny(context.modeDeniedPermissions) };`,
  "tool.mode.permissions.allowed": `forbid(principal, action == Polychat::Action::"tool.use", resource)
    when { context.enforceMode && !context.modeAllowedPermissions.isEmpty() && !context.modeAllowedPermissions.containsAll(context.permissions) };`,
  "tool.approval": `permit(principal, action == Polychat::Action::"tool.unattended", resource)
    when { context.toolName == "request_approval" ||
      (!context.permissions.containsAny(context.requiredApprovalPermissions) &&
       (!context.enforceMode || !context.permissions.containsAny(context.modeApprovalPermissions))) };`,
};
