import { createAuthorizer, namedPolicies } from "./engine.js";
import { executionPolicies } from "./policies/execution.js";
import { modelPolicies } from "./policies/models.js";
import { platformPolicies } from "./policies/platform.js";
import { scopePolicies } from "./policies/scope.js";
import { toolPolicies } from "./policies/tools.js";
import {
  actionSchema,
  booleanAttribute as boolean,
  longAttribute as long,
  stringAttribute as string,
  stringSetAttribute as strings,
  type ContextFromShape,
} from "./schema.js";

const resourceShape = {
  actorId: string,
  ownerId: string,
  scope: string,
  member: boolean,
  role: string,
};
const modelShape = {
  plan: string,
  active: boolean,
  free: boolean,
  byok: boolean,
  onDevice: boolean,
  platformEnabled: boolean,
};
const recordShape = {
  actorId: string,
  tableOwnerId: string,
  rowOwnerId: string,
  scope: string,
  member: boolean,
  role: string,
  visibility: string,
  editing: string,
  active: boolean,
};
const toolShape = {
  toolName: string,
  toolType: string,
  plan: string,
  signedIn: boolean,
  enforceMode: boolean,
  permissions: strings,
  deniedTools: strings,
  modeDeniedTools: strings,
  modeAllowedTools: strings,
  modeDeniedPermissions: strings,
  modeAllowedPermissions: strings,
  requiredApprovalPermissions: strings,
  modeApprovalPermissions: strings,
};

const actionShapes = {
  "entitlement.pro": { plan: string },
  "platform.admin": { role: string, strict: boolean },
  "service.call": { authenticated: boolean, scopes: strings, requiredScope: string },
  "workspace.membership": { actorRole: string, targetRole: string, newRole: string },
  "capability.manage": {
    kind: string,
    role: string,
    existing: boolean,
    actorId: string,
    creatorId: string,
  },
  "memory.retrieve": {
    plan: string,
    signedIn: boolean,
    store: boolean,
    saveEnabled: boolean,
    historyEnabled: boolean,
  },
  "memory.store": {
    plan: string,
    signedIn: boolean,
    store: boolean,
    saveEnabled: boolean,
    historyEnabled: boolean,
  },
  "work.access": { plan: string },
  "workspace.access": { plan: string, member: boolean, role: string, allowedRoles: strings },
  "resource.read": resourceShape,
  "resource.write": resourceShape,
  "task.flow.respond": { actorId: string, assigneeId: string, member: boolean, role: string },
  "records.read": recordShape,
  "records.write": recordShape,
  "owner.access": { actorId: string, ownerId: string },
  "conversation.share": { actorId: string, ownerId: string, project: boolean },
  "conversation.public": { project: boolean, isPublic: boolean },
  "conversation.access": {
    actorId: string,
    ownerId: string,
    project: boolean,
    plan: string,
    member: boolean,
    teammateActorId: string,
  },
  "teammate.read": resourceShape,
  "teammate.write": resourceShape,
  "capability.use": { granted: boolean, excluded: boolean },
  "tool.use": toolShape,
  "tool.unattended": toolShape,
  "model.execute": modelShape,
  "model.platform": modelShape,
  "model.action": { member: boolean, role: string, grants: strings, requestedAction: string },
  "model.approve": { separationOfDuties: boolean, actorId: string, requestedBy: string },
  "model.use": { ready: boolean, revoked: boolean, covered: boolean, active: boolean },
  "model.host": { pauseSupported: boolean, requiresPause: boolean },
  "model.gate": { runPresent: boolean, thresholdsMet: boolean },
  "model.alias.activate": {
    required: boolean,
    separationOfDuties: boolean,
    canApprove: boolean,
    requestExists: boolean,
  },
  "model.suite.delete": { actorId: string, ownerId: string, managesPolicy: boolean },
  "spend.execute": {
    valid: boolean,
    hardStop: boolean,
    overMonthly: boolean,
    aboveApproval: boolean,
    unknownEstimate: boolean,
    overSoft: boolean,
  },
  "spend.unattended": {
    valid: boolean,
    hardStop: boolean,
    overMonthly: boolean,
    aboveApproval: boolean,
    unknownEstimate: boolean,
    overSoft: boolean,
  },
  "spend.silent": {
    valid: boolean,
    hardStop: boolean,
    overMonthly: boolean,
    aboveApproval: boolean,
    unknownEstimate: boolean,
    overSoft: boolean,
  },
  "spend.authorise": {
    required: boolean,
    approved: boolean,
    canApprove: boolean,
    separationOfDuties: boolean,
  },
  "git.write": {
    refs: strings,
    allowedRefs: strings,
    targetRef: string,
    approvedTargetRef: string,
  },
  "sandbox.command": {
    length: long,
    multiline: boolean,
    chains: boolean,
    evaluation: boolean,
    readOnly: boolean,
    readOnlyMutation: boolean,
    readOnlyOperator: boolean,
    readOnlyAllowed: boolean,
    forbidden: boolean,
    trustLevel: string,
    allowNetwork: boolean,
    allowRisky: boolean,
    network: boolean,
    risky: boolean,
  },
  "sandbox.network": { protocolAllowed: boolean, mode: string, hostMatched: boolean },
  "sandbox.tool": { attached: boolean },
  "governance.cover": {
    evaluationFailed: boolean,
    expiresAt: long,
    now: long,
    effect: string,
    exception: boolean,
    seen: strings,
    matchKey: string,
  },
  "delegation.control": {
    actorId: string,
    initiatorId: string,
    conversationId: string,
    parentConversationId: string,
    conversationAccessible: boolean,
  },
  "browser.use": {
    actorId: string,
    ownerId: string,
    destroyed: boolean,
    workspaceId: string,
    sessionWorkspaceId: string,
  },
  "connector.unattended": { supported: boolean, access: string, destructive: boolean },
  "computer.unattended": { inputType: string, key: string },
  "grant.operation": { operations: strings, operation: string },
  "grant.revision": {
    connectionId: string,
    approvedConnectionId: string,
    revision: long,
    approvedRevision: long,
    operations: strings,
    operation: string,
  },
  "connector.replay": {
    sessionId: string,
    requestSessionId: string,
    kind: string,
    actorId: string,
    ownerId: string,
    sessionScope: string,
    approvalScope: string,
    operations: strings,
    operation: string,
    hasAuthConfig: boolean,
    hasConnectedAccount: boolean,
    state: string,
    expiresAt: long,
    now: long,
  },
  "run.effect": {
    exists: boolean,
    attempt: long,
    expectedAttempt: long,
    status: string,
    cancelled: boolean,
  },
};

export type AuthorisationContexts = {
  [Action in keyof typeof actionShapes]: ContextFromShape<(typeof actionShapes)[Action]>;
};

export type ToolPolicyContext = AuthorisationContexts["tool.use"];

export function authorisationBundle() {
  return {
    id: "polychat.authorisation.v1",
    schema: actionSchema(actionShapes),
    policies: namedPolicies({
      ...scopePolicies,
      ...toolPolicies,
      ...modelPolicies,
      ...executionPolicies,
      ...platformPolicies,
    }),
  };
}

let authorizer: ReturnType<typeof createAuthorizer> | undefined;

export function authorise<Action extends keyof AuthorisationContexts>(
  action: Action,
  context: AuthorisationContexts[Action],
) {
  authorizer ??= createAuthorizer(authorisationBundle(), { preparse: true });

  return authorizer({
    principal: { type: "Polychat::Actor", id: "request" },
    action: { type: "Polychat::Action", id: action },
    resource: { type: "Polychat::Resource", id: "request" },
    context: { ...context },
  });
}

export function ownsResource(
  actorId: number | string | null | undefined,
  ownerId: unknown,
): boolean {
  if (
    actorId === null ||
    actorId === undefined ||
    typeof actorId !== typeof ownerId ||
    (typeof ownerId !== "number" && typeof ownerId !== "string")
  ) {
    return false;
  }

  return authorise("owner.access", { actorId: String(actorId), ownerId: String(ownerId) }).allowed;
}

export function hasProEntitlement(user: { plan_id?: string | null } | null | undefined): boolean {
  return authorise("entitlement.pro", { plan: user?.plan_id ?? "" }).allowed;
}

export function operationIsGranted(operations: readonly string[], operation: string): boolean {
  return authorise("grant.operation", { operations: [...operations], operation }).allowed;
}
