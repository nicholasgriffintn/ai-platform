import {
  authorise,
  operationIsGranted,
  type ToolPolicyContext,
} from "@ngriffin_uk/polychat-library-policy";
import {
  AGENT_MODE_CONFIGS,
  TOOL_PERMISSIONS,
  resolveAgentModeFromChatMode,
  type AgentMode,
  type TeammateAutonomyLevel,
  type ToolEffectClass,
  type ToolPermission,
} from "@ngriffin_uk/polychat-schemas";

import { toolApprovalReason, toolDenialReason } from "./permission-reason.js";

export interface ToolAccessSubject {
  id?: number | string;
  plan_id?: string | null;
}

const VALID_PERMISSIONS = new Set<ToolPermission>(TOOL_PERMISSIONS);

const DEFAULT_TOOL_PERMISSIONS: ToolPermission[] = ["read"];

export interface PermissionCheckInput {
  toolName: string;
  mode?: string | null;
  enforceModePolicy?: boolean;
  user?: ToolAccessSubject | null;
  toolType?: "normal" | "premium" | "byok";
  toolPermissions?: string[];
  requireApprovalFor?: readonly ToolPermission[];
  deniedTools?: readonly string[];
  effectClass?: ToolEffectClass;
  autonomyLevel?: TeammateAutonomyLevel | null;
  standingApproval?: boolean;
}

export interface RequestPermissionCheckInput extends PermissionCheckInput {
  approvedTools?: readonly unknown[];
}

export interface PermissionCheckResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
  mode: AgentMode;
  permissions: ToolPermission[];
}

export interface RequestPermissionCheckResult extends PermissionCheckResult {
  approved: boolean;
}

export function resolveToolPermissions(
  _toolName: string,
  explicitPermissions?: string[],
): ToolPermission[] {
  const seen = new Set<ToolPermission>();
  const permissions: ToolPermission[] = [];

  for (const value of explicitPermissions || []) {
    if (!value) {
      continue;
    }

    const normalisedValue = value.toLowerCase();
    const permission = TOOL_PERMISSIONS.find((candidate) => candidate === normalisedValue);

    if (!permission || !VALID_PERMISSIONS.has(permission) || seen.has(permission)) {
      continue;
    }

    seen.add(permission);
    permissions.push(permission);
  }

  return permissions;
}

export function resolveModeMaxSteps(mode?: string | null, requestedMaxSteps?: number): number {
  const resolvedMode = resolveAgentModeFromChatMode(mode);
  const modeMax = AGENT_MODE_CONFIGS[resolvedMode].maxSteps;

  if (typeof requestedMaxSteps !== "number" || !Number.isFinite(requestedMaxSteps)) {
    return modeMax;
  }

  return Math.max(1, Math.min(Math.floor(requestedMaxSteps), modeMax));
}

export class PermissionChecker {
  checkRequestToolAccess(input: RequestPermissionCheckInput): RequestPermissionCheckResult {
    const access = this.checkToolAccess(input);
    const targetName = input.toolName.trim().toLowerCase();
    const approved = operationIsGranted(
      (input.approvedTools ?? []).flatMap((tool) =>
        typeof tool === "string" ? [tool.trim().toLowerCase()] : [],
      ),
      targetName,
    );

    return {
      ...access,
      approved,
    };
  }

  checkToolAccess(input: PermissionCheckInput): PermissionCheckResult {
    const mode = resolveAgentModeFromChatMode(input.mode);
    const config = AGENT_MODE_CONFIGS[mode];
    const configured = resolveToolPermissions(input.toolName, input.toolPermissions);
    const permissions = configured.length > 0 ? configured : DEFAULT_TOOL_PERMISSIONS;
    const context: ToolPolicyContext = {
      toolName: input.toolName,
      toolType: input.toolType ?? "normal",
      plan: input.user?.plan_id ?? "",
      signedIn: Boolean(input.user?.id),
      enforceMode: input.enforceModePolicy !== false,
      permissions,
      deniedTools: [...(input.deniedTools ?? [])],
      modeDeniedTools: config.deniedTools,
      modeAllowedTools: config.allowedTools,
      modeDeniedPermissions: config.deniedPermissions,
      modeAllowedPermissions: config.allowedPermissions,
      requiredApprovalPermissions: [...(input.requireApprovalFor ?? [])],
      modeApprovalPermissions: config.requiresApprovalFor,
      effectClass: input.effectClass ?? "",
      autonomyLevel: input.autonomyLevel ?? "",
      standingApproval: input.standingApproval ?? false,
    };
    const decision = authorise("tool.use", context);

    if (!decision.allowed) {
      return {
        allowed: false,
        requiresApproval: false,
        reason: toolDenialReason(decision.policyIds, context, mode),
        mode,
        permissions,
      };
    }

    const unattended = authorise("tool.unattended", context);
    const requiresApproval = !unattended.allowed;
    const approvalPermissions = permissions.filter(
      (permission) =>
        context.requiredApprovalPermissions.includes(permission) ||
        (context.enforceMode && context.modeApprovalPermissions.includes(permission)),
    );

    return {
      allowed: true,
      requiresApproval,
      reason: requiresApproval
        ? toolApprovalReason(unattended.policyIds, context, mode, approvalPermissions)
        : undefined,
      mode,
      permissions,
    };
  }
}
