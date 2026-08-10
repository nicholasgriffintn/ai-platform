import type {
	ProjectCapability,
	ProjectConversation,
	ProjectDetail,
	ProjectSummary,
	WorkspaceInvitation,
	WorkspaceMember,
	WorkspaceSummary,
} from "@assistant/schemas";

import type {
	ProjectCapabilityRow,
	ProjectConversationRow,
	ProjectRow,
	WorkspaceInvitationRow,
	WorkspaceMemberRow,
	WorkspaceSummaryRow,
} from "~/repositories/WorkspaceRepository";
import { safeParseJson } from "~/utils/json";

export function formatWorkspaceSummary(row: WorkspaceSummaryRow): WorkspaceSummary {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		colour: row.colour,
		role: row.role,
		memberCount: Number(row.member_count),
		projectCount: Number(row.project_count),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

export function formatWorkspaceMember(row: WorkspaceMemberRow): WorkspaceMember {
	return {
		userId: row.user_id,
		name: row.name,
		email: row.email,
		avatarUrl: row.avatar_url,
		role: row.role,
		joinedAt: row.joined_at,
	};
}

export function formatWorkspaceInvitation(row: WorkspaceInvitationRow): WorkspaceInvitation {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		email: row.email,
		role: row.role,
		status:
			row.status === "pending" && new Date(row.expires_at).getTime() <= Date.now()
				? "expired"
				: row.status,
		expiresAt: row.expires_at,
		createdAt: row.created_at,
	};
}

export function formatProjectSummary(row: ProjectRow): ProjectSummary {
	return {
		id: row.id,
		workspaceId: row.workspace_id,
		name: row.name,
		description: row.description,
		instructions: row.instructions,
		colour: row.colour,
		createdBy: row.created_by,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		conversationCount: Number(row.conversation_count),
		capabilityCount: Number(row.capability_count),
	};
}

export function formatProjectCapability(row: ProjectCapabilityRow): ProjectCapability {
	const configuration =
		typeof row.configuration === "string"
			? (safeParseJson<Record<string, unknown>>(row.configuration) ?? {})
			: (row.configuration ?? {});
	return {
		id: row.id,
		projectId: row.project_id,
		kind: row.kind,
		capabilityId: row.capability_id,
		configuration,
		createdAt: row.created_at,
	};
}

export function formatProjectConversation(row: ProjectConversationRow): ProjectConversation {
	return {
		id: row.id,
		title: row.title,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastMessageAt: row.last_message_at,
		messageCount: Number(row.message_count ?? 0),
		createdBy: {
			id: row.created_by,
			name: row.created_by_name,
			avatarUrl: row.created_by_avatar_url,
		},
	};
}

export function formatProjectDetail(params: {
	project: ProjectRow;
	capabilities: ProjectCapabilityRow[];
	conversations: ProjectConversationRow[];
}): ProjectDetail {
	return {
		...formatProjectSummary(params.project),
		capabilities: params.capabilities.map(formatProjectCapability),
		conversations: params.conversations.map(formatProjectConversation),
	};
}
