export const executionPolicies = {
  "sandbox.command": `permit(principal, action == Polychat::Action::"sandbox.command", resource)
    when { ["strict", "balanced", "trusted"].contains(context.trustLevel) };`,
  "sandbox.command.length": `forbid(principal, action == Polychat::Action::"sandbox.command", resource) when { context.length > 500 };`,
  "sandbox.command.multiline": `forbid(principal, action == Polychat::Action::"sandbox.command", resource) when { context.multiline };`,
  "sandbox.command.chains": `forbid(principal, action == Polychat::Action::"sandbox.command", resource) when { context.chains };`,
  "sandbox.command.evaluation": `forbid(principal, action == Polychat::Action::"sandbox.command", resource) when { context.evaluation };`,
  "sandbox.command.readonly": `forbid(principal, action == Polychat::Action::"sandbox.command", resource)
    when { context.readOnly && (context.readOnlyMutation || context.readOnlyOperator) };`,
  "sandbox.command.unknown": `forbid(principal, action == Polychat::Action::"sandbox.command", resource)
    when { context.readOnly && !context.readOnlyAllowed };`,
  "sandbox.command.forbidden": `forbid(principal, action == Polychat::Action::"sandbox.command", resource) when { context.forbidden };`,
  "sandbox.command.network": `forbid(principal, action == Polychat::Action::"sandbox.command", resource)
    when { ["strict", "balanced"].contains(context.trustLevel) && context.network && !context.allowNetwork };`,
  "sandbox.command.risky": `forbid(principal, action == Polychat::Action::"sandbox.command", resource)
    when { context.trustLevel == "strict" && context.risky && !context.allowRisky };`,
  "sandbox.network": `permit(principal, action == Polychat::Action::"sandbox.network", resource)
    when { context.protocolAllowed && (context.mode == "all" || (context.mode == "list" && context.hostMatched)) };`,
  "sandbox.egress": `permit(principal, action == Polychat::Action::"sandbox.egress", resource)
    when { context.protocolAllowed && (context.mode == "all" || context.hostMatched || (context.readOnlyHostMatched && context.safeMethod)) };`,
  "sandbox.tool": `permit(principal, action == Polychat::Action::"sandbox.tool", resource) when { context.attached };`,
  "execution.owner": `permit(principal, action == Polychat::Action::"owner.access", resource)
    when { context.actorId != "" && context.actorId == context.ownerId };`,
  "execution.delegation": `permit(principal, action == Polychat::Action::"delegation.control", resource)
    when { context.actorId == context.initiatorId && context.conversationId == context.parentConversationId && context.conversationAccessible };`,
  "execution.browser": `permit(principal, action == Polychat::Action::"browser.use", resource)
    when { context.actorId == context.ownerId && !context.destroyed && context.workspaceId == context.sessionWorkspaceId };`,
  "execution.connector.unattended": `permit(principal, action == Polychat::Action::"connector.unattended", resource)
    when { context.supported && context.access == "read" && !context.destructive };`,
  "execution.computer.unattended": `permit(principal, action == Polychat::Action::"computer.unattended", resource)
    when { ["navigate", "click", "key", "scroll", "wait", "read"].contains(context.inputType) && !(context.inputType == "key" && ["Return", "Tab", "ctrl+v"].contains(context.key)) };`,
  "execution.grant.operation": `permit(principal, action == Polychat::Action::"grant.operation", resource)
    when { context.operations.contains(context.operation) };`,
  "execution.connector.replay": `permit(principal, action == Polychat::Action::"connector.replay", resource)
    when { context.sessionId == context.requestSessionId && context.kind == "tool" && context.actorId == context.ownerId &&
      context.sessionScope == context.approvalScope && context.operations.contains(context.operation) &&
      context.hasAuthConfig && context.hasConnectedAccount && ["active", "claimed"].contains(context.state) &&
      context.expiresAt > context.now };`,
  "execution.grant.revision": `permit(principal, action == Polychat::Action::"grant.revision", resource)
    when { context.connectionId == context.approvedConnectionId && context.revision == context.approvedRevision && context.operations.contains(context.operation) };`,
  "execution.run": `permit(principal, action == Polychat::Action::"run.effect", resource)
    when { context.exists && context.attempt == context.expectedAttempt && context.status == "running" && !context.cancelled };`,
};
