export const platformPolicies = {
  "platform.pro": `permit(principal, action == Polychat::Action::"entitlement.pro", resource)
    when { ["pro", "agent"].contains(context.plan) };`,
  "platform.admin": `permit(principal, action == Polychat::Action::"platform.admin", resource)
    when { context.role == "admin" || (!context.strict && context.role == "moderator") };`,
  "platform.service": `permit(principal, action == Polychat::Action::"service.call", resource)
    when { context.authenticated && context.scopes.contains(context.requiredScope) };`,
  "platform.membership": `permit(principal, action == Polychat::Action::"workspace.membership", resource)
    when { ["", "admin", "member"].contains(context.targetRole) && ["", "admin", "member"].contains(context.newRole) &&
      (context.actorRole == "owner" || (context.actorRole == "admin" && context.targetRole != "admin" && context.newRole != "admin")) };`,
  "platform.seat.claim": `permit(principal, action == Polychat::Action::"workspace.seat.claim", resource)
    when { !context.seatLimited || context.occupied < context.seatLimit };`,
  "platform.team-plan.provision": `permit(principal, action == Polychat::Action::"workspace.plan.provision", resource)
    when { context.role == "admin" && context.seatLimit > 0 && context.occupied <= context.seatLimit };`,
  "platform.team-plan.end": `permit(principal, action == Polychat::Action::"workspace.plan.end", resource)
    when { context.role == "admin" };`,
  "platform.pool.draw": `permit(principal, action == Polychat::Action::"workspace.pool.draw", resource)
    when { context.pooled && context.member && ["owner", "admin", "member"].contains(context.role) };`,
  "platform.credential.personal": `permit(principal, action == Polychat::Action::"credential.personal", resource)
    when { !context.pooled };`,
  "platform.capability.manage": `permit(principal, action == Polychat::Action::"capability.manage", resource)
    when { (["tool", "connector"].contains(context.kind) && ["owner", "admin"].contains(context.role)) ||
      (!["tool", "connector"].contains(context.kind) && (!context.existing || context.actorId == context.creatorId)) };`,
  "platform.memory.retrieve": `permit(principal, action == Polychat::Action::"memory.retrieve", resource)
    when { ["pro", "agent"].contains(context.plan) && context.signedIn && context.store && (context.saveEnabled || context.historyEnabled) };`,
  "platform.memory.store": `permit(principal, action == Polychat::Action::"memory.store", resource)
    when { ["pro", "agent"].contains(context.plan) && context.signedIn && context.store && context.saveEnabled };`,
};
