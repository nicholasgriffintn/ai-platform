export const scopePolicies = {
  "scope.task.flow.respond": `permit(principal, action == Polychat::Action::"task.flow.respond", resource)
    when { context.member && ["owner", "admin", "member"].contains(context.role) &&
      (["owner", "admin"].contains(context.role) || context.assigneeId == "" || context.actorId == context.assigneeId) };`,

  "scope.records.read": `permit(principal, action == Polychat::Action::"records.read", resource)
    when { ["shared", "creator"].contains(context.visibility) && ["shared", "creator"].contains(context.editing) && !(context.visibility == "creator" && context.editing == "shared") &&
     ((context.scope == "personal" && context.actorId == context.tableOwnerId) ||
      (context.scope == "project" && context.member && ["owner", "admin", "member"].contains(context.role) &&
       (context.visibility == "shared" || context.actorId == context.rowOwnerId || context.actorId == context.tableOwnerId || ["owner", "admin"].contains(context.role)))) };`,
  "scope.records.write": `permit(principal, action == Polychat::Action::"records.write", resource)
    when { context.active && ["shared", "creator"].contains(context.visibility) && ["shared", "creator"].contains(context.editing) && !(context.visibility == "creator" && context.editing == "shared") &&
     ((context.scope == "personal" && context.actorId == context.tableOwnerId) ||
      (context.scope == "project" && context.member && ["owner", "admin", "member"].contains(context.role) &&
       (context.editing == "shared" || context.actorId == context.rowOwnerId || context.actorId == context.tableOwnerId || ["owner", "admin"].contains(context.role)))) };`,
  "scope.work": `permit(principal, action == Polychat::Action::"work.access", resource)
    when { context.plan == "pro" };`,
  "scope.workspace": `permit(principal, action == Polychat::Action::"workspace.access", resource)
    when { context.plan == "pro" && context.member && context.allowedRoles.contains(context.role) };`,
  "scope.personal": `permit(principal, action == Polychat::Action::"resource.read", resource)
    when { context.scope == "personal" && context.actorId == context.ownerId };
    permit(principal, action == Polychat::Action::"resource.write", resource)
    when { context.scope == "personal" && context.actorId == context.ownerId };`,
  "scope.project.read": `permit(principal, action == Polychat::Action::"resource.read", resource)
    when { ["project", "workspace"].contains(context.scope) && context.member && ["owner", "admin", "member"].contains(context.role) };`,
  "scope.project.write": `permit(principal, action == Polychat::Action::"resource.write", resource)
    when { ["project", "workspace"].contains(context.scope) && context.member &&
      (["owner", "admin"].contains(context.role) || (context.role == "member" && context.actorId == context.ownerId)) };`,
  "scope.share": `permit(principal, action == Polychat::Action::"conversation.share", resource)
    when { !context.project && context.actorId == context.ownerId };
    forbid(principal, action == Polychat::Action::"conversation.share", resource)
    when { context.project };`,
  "scope.public": `permit(principal, action == Polychat::Action::"conversation.public", resource)
    when { !context.project && context.isPublic };`,
  "scope.conversation": `permit(principal, action == Polychat::Action::"conversation.access", resource)
    when { (context.project && context.plan == "pro" && context.member) ||
      (!context.project && context.actorId == context.ownerId) };
    forbid(principal, action == Polychat::Action::"conversation.access", resource)
    when { context.teammateActorId != "" && context.actorId != context.teammateActorId };`,
  "scope.teammate.read": `permit(principal, action == Polychat::Action::"teammate.read", resource)
    when { context.scope == "platform" ||
      (context.scope == "user" && context.actorId == context.ownerId) ||
      (context.scope == "workspace" && context.member && ["owner", "admin", "member"].contains(context.role)) };`,
  "scope.teammate.write": `permit(principal, action == Polychat::Action::"teammate.write", resource)
    when { (context.scope == "user" && context.actorId == context.ownerId) ||
      (context.scope == "workspace" && context.member && ["owner", "admin"].contains(context.role)) };
    forbid(principal, action == Polychat::Action::"teammate.write", resource)
    when { context.scope == "platform" };`,
  "scope.capability": `permit(principal, action == Polychat::Action::"capability.use", resource)
    when { context.granted && !context.excluded };`,
};
