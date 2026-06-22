import {
	AGENT_MODE_CONFIGS,
	TOOL_PERMISSIONS,
	resolveAgentModeFromChatMode,
	type AgentMode,
	type ToolPermission,
} from "@assistant/schemas";
import type { ChatMode, IUser } from "~/types";

const VALID_PERMISSIONS = new Set<ToolPermission>(TOOL_PERMISSIONS);

const DEFAULT_TOOL_PERMISSIONS: ToolPermission[] = ["read"];

export interface PermissionCheckInput {
	toolName: string;
	mode?: ChatMode | string;
	user?: IUser;
	toolType?: "normal" | "premium" | "byok";
	toolPermissions?: string[];
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

export function resolveModeMaxSteps(mode?: ChatMode | string, requestedMaxSteps?: number): number {
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
		const approved = Boolean(
			input.approvedTools?.some(
				(tool) => typeof tool === "string" && tool.trim().toLowerCase() === targetName,
			),
		);

		return {
			...access,
			approved,
		};
	}

	checkToolAccess(input: PermissionCheckInput): PermissionCheckResult {
		const resolvedMode = resolveAgentModeFromChatMode(input.mode);
		const config = AGENT_MODE_CONFIGS[resolvedMode];
		const toolName = input.toolName;
		const configuredPermissions = resolveToolPermissions(toolName, input.toolPermissions || []);
		const permissions =
			configuredPermissions.length > 0 ? configuredPermissions : DEFAULT_TOOL_PERMISSIONS;

		if (input.toolType === "premium" && input.user?.plan_id !== "pro") {
			return {
				allowed: false,
				requiresApproval: false,
				reason: "This tool requires a premium subscription",
				mode: resolvedMode,
				permissions,
			};
		}

		if (input.toolType === "byok" && !input.user?.id) {
			return {
				allowed: false,
				requiresApproval: false,
				reason: "This tool requires a signed-in user",
				mode: resolvedMode,
				permissions,
			};
		}

		if (config.deniedTools.includes(toolName)) {
			return {
				allowed: false,
				requiresApproval: false,
				reason: `Tool "${toolName}" is not allowed in ${resolvedMode} mode`,
				mode: resolvedMode,
				permissions,
			};
		}

		if (config.allowedTools.length > 0 && !config.allowedTools.includes(toolName)) {
			return {
				allowed: false,
				requiresApproval: false,
				reason: `Tool "${toolName}" is not enabled in ${resolvedMode} mode`,
				mode: resolvedMode,
				permissions,
			};
		}

		const deniedByPermissions = this.intersectPermissions(permissions, config.deniedPermissions);
		if (deniedByPermissions.length > 0) {
			return {
				allowed: false,
				requiresApproval: false,
				reason: `Tool "${toolName}" is blocked in ${resolvedMode} mode (${deniedByPermissions.join(", ")})`,
				mode: resolvedMode,
				permissions,
			};
		}

		if (config.allowedPermissions.length > 0) {
			const allowedSet = new Set(config.allowedPermissions);
			const disallowed = permissions.filter((permission) => !allowedSet.has(permission));

			if (disallowed.length > 0) {
				return {
					allowed: false,
					requiresApproval: false,
					reason: `Tool "${toolName}" is not compatible with ${resolvedMode} mode (${disallowed.join(", ")})`,
					mode: resolvedMode,
					permissions,
				};
			}
		}

		const requiredApprovalFor = this.intersectPermissions(permissions, config.requiresApprovalFor);
		const requiresApproval = requiredApprovalFor.length > 0 && toolName !== "request_approval";

		return {
			allowed: true,
			requiresApproval,
			reason: requiresApproval
				? `Tool "${toolName}" requires approval in ${resolvedMode} mode (${requiredApprovalFor.join(", ")})`
				: undefined,
			mode: resolvedMode,
			permissions,
		};
	}

	private intersectPermissions(permissions: ToolPermission[], candidates: ToolPermission[]) {
		const candidateSet = new Set(candidates);
		return permissions.filter((permission) => candidateSet.has(permission));
	}
}
