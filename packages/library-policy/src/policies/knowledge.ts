export const knowledgePolicies = {
  "knowledge.configure": `permit(principal, action == Polychat::Action::"knowledge.configure", resource)
    when { (context.scope == "personal" && context.actorId == context.ownerId) ||
      (context.scope == "project" && context.member && ["owner", "admin"].contains(context.role)) };`,
  "knowledge.attach": `permit(principal, action == Polychat::Action::"knowledge.attach", resource)
    when { context.connected && context.member && ["owner", "admin"].contains(context.role) };`,
  "knowledge.retrieve": `permit(principal, action == Polychat::Action::"knowledge.retrieve", resource)
    when { context.retrieval != "excluded" };
    forbid(principal, action == Polychat::Action::"knowledge.retrieve", resource)
    when { context.teammate && context.sensitivity == "confidential" };`,
};
