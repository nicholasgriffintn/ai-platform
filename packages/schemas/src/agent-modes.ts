import z from "zod/v4";

export const TOOL_PERMISSIONS = [
	"read",
	"reasoning",
	"network",
	"write",
	"sandbox",
	"orchestration",
	"human",
	"delegate",
] as const;

export const toolPermissionSchema = z.enum(TOOL_PERMISSIONS);

export type ToolPermission = (typeof TOOL_PERMISSIONS)[number];

export const agentModeSchema = z.enum(["chat", "plan", "build", "explore"]);
export type AgentMode = z.infer<typeof agentModeSchema>;

export const chatRequestModeSchema = z.enum([
	"normal",
	"thinking",
	"no_system",
	"local",
	"remote",
	"agent",
	"plan",
	"build",
	"explore",
]);

export type ChatRequestMode = z.infer<typeof chatRequestModeSchema>;

export const agentModeConfigSchema = z.object({
	maxSteps: z.number().int().positive(),
	allowedTools: z.array(z.string()).default([]),
	deniedTools: z.array(z.string()).default([]),
	allowedPermissions: z.array(toolPermissionSchema).default([]),
	deniedPermissions: z.array(toolPermissionSchema).default([]),
	requiresApprovalFor: z.array(toolPermissionSchema).default([]),
});

export type AgentModeConfig = z.infer<typeof agentModeConfigSchema>;

const allPermissions = [...TOOL_PERMISSIONS];

export const AGENT_MODE_CONFIGS: Record<AgentMode, AgentModeConfig> = {
	chat: {
		maxSteps: 1,
		allowedPermissions: allPermissions,
		deniedPermissions: [],
		requiresApprovalFor: [],
		allowedTools: [],
		deniedTools: [],
	},
	plan: {
		maxSteps: 24,
		allowedPermissions: ["read", "reasoning"],
		deniedPermissions: [
			"network",
			"write",
			"sandbox",
			"orchestration",
			"human",
			"delegate",
		],
		requiresApprovalFor: [],
		allowedTools: [],
		deniedTools: [],
	},
	build: {
		maxSteps: 48,
		allowedPermissions: allPermissions,
		deniedPermissions: [],
		requiresApprovalFor: [
			"network",
			"write",
			"sandbox",
			"orchestration",
			"delegate",
		],
		allowedTools: [],
		deniedTools: [],
	},
	explore: {
		maxSteps: 24,
		allowedPermissions: ["read", "reasoning"],
		deniedPermissions: [
			"network",
			"write",
			"sandbox",
			"orchestration",
			"human",
			"delegate",
		],
		requiresApprovalFor: [],
		allowedTools: [],
		deniedTools: [],
	},
};

export function resolveAgentModeFromChatMode(mode?: string | null): AgentMode {
	if (mode === "plan") {
		return "plan";
	}

	if (mode === "build" || mode === "agent") {
		return "build";
	}

	if (mode === "explore") {
		return "explore";
	}

	return "chat";
}
