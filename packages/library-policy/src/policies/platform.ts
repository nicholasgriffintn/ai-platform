export const platformPolicies = {
  "platform.identity-provision": `permit(principal, action == Polychat::Action::"workspace.identity.provision", resource)
    when { context.verified && context.enabled && context.revisionCurrent
      && context.groupsMapped && context.leaseCurrent && ["admin", "member"].contains(context.role) };`,

  "platform.pro": `permit(principal, action == Polychat::Action::"entitlement.pro", resource)
    when { context.plan == "pro" };`,
  "platform.admin": `permit(principal, action == Polychat::Action::"platform.admin", resource)
    when { context.role == "admin" || (!context.strict && context.role == "moderator") };`,
  "platform.service": `permit(principal, action == Polychat::Action::"service.call", resource)
    when { context.authenticated && context.scopes.contains(context.requiredScope) };`,
  "platform.membership": `permit(principal, action == Polychat::Action::"workspace.membership", resource)
    when { ["", "admin", "member"].contains(context.targetRole) && ["", "admin", "member"].contains(context.newRole) &&
      (context.actorRole == "owner" || (context.actorRole == "admin" && context.targetRole != "admin" && context.newRole != "admin")) };`,
  "platform.capability.manage": `permit(principal, action == Polychat::Action::"capability.manage", resource)
    when { (["tool", "connector"].contains(context.kind) && ["owner", "admin"].contains(context.role)) ||
      (!["tool", "connector"].contains(context.kind) && (!context.existing || context.actorId == context.creatorId)) };`,
  "platform.memory.retrieve": `permit(principal, action == Polychat::Action::"memory.retrieve", resource)
    when { context.plan == "pro" && context.signedIn && context.store && (context.saveEnabled || context.historyEnabled) };`,
  "platform.memory.store": `permit(principal, action == Polychat::Action::"memory.store", resource)
    when { context.plan == "pro" && context.signedIn && context.store && context.saveEnabled };`,
};
