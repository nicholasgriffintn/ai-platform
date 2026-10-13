export const modelPolicies = {
  "model.gate": `permit(principal, action == Polychat::Action::"model.gate", resource)
    when { context.runPresent && context.thresholdsMet };`,
  "model.host": `permit(principal, action == Polychat::Action::"model.host", resource)
    when { !context.requiresPause || context.pauseSupported };`,
  "model.use": `permit(principal, action == Polychat::Action::"model.use", resource)
    when { context.ready && !context.revoked && context.covered && context.active };`,
  "model.alias.activate": `permit(principal, action == Polychat::Action::"model.alias.activate", resource)
    when { (!context.required && !context.separationOfDuties) ||
      (context.canApprove && (!context.separationOfDuties || context.requestExists)) };`,
  "model.suite.delete": `permit(principal, action == Polychat::Action::"model.suite.delete", resource)
    when { context.actorId == context.ownerId || context.managesPolicy };`,
  "spend.execute": `permit(principal, action == Polychat::Action::"spend.execute", resource)
    when { context.valid && !(context.hardStop && context.overMonthly) };`,
  "spend.unattended": `permit(principal, action == Polychat::Action::"spend.unattended", resource)
    when { context.valid && !(context.hardStop && context.overMonthly) && !context.aboveApproval };`,
  "spend.silent": `permit(principal, action == Polychat::Action::"spend.silent", resource)
    when { context.valid && !context.overMonthly && !context.aboveApproval && !context.unknownEstimate && !context.overSoft };`,
  "spend.authorise": `permit(principal, action == Polychat::Action::"spend.authorise", resource)
    when { !context.required || context.approved || (context.canApprove && !context.separationOfDuties) };`,
  "git.write": `permit(principal, action == Polychat::Action::"git.write", resource)
    when { !context.refs.isEmpty() && context.allowedRefs.containsAll(context.refs) &&
      context.targetRef == context.approvedTargetRef };`,
  "model.execute": `permit(principal, action == Polychat::Action::"model.execute", resource)
    when { context.active && (context.plan == "pro" || context.free || context.byok || context.onDevice) &&
      (context.platformEnabled || context.byok) };`,
  "model.platform": `permit(principal, action == Polychat::Action::"model.platform", resource)
    when { !(context.byok && (!context.platformEnabled || (context.plan != "pro" && !context.free))) };`,
  "model.grants": `permit(principal, action == Polychat::Action::"model.action", resource)
    when { context.member && ["owner", "admin", "member"].contains(context.role) && context.grants.contains(context.requestedAction) };`,
  "model.approve": `permit(principal, action == Polychat::Action::"model.approve", resource)
    when { !context.separationOfDuties || context.actorId != context.requestedBy };`,
  "model.coverage": `permit(principal, action == Polychat::Action::"governance.cover", resource)
    when { !context.evaluationFailed && (context.expiresAt == 0 || context.expiresAt > context.now) &&
      (context.effect != "block" || context.exception) && context.seen.contains(context.matchKey) };`,
};
