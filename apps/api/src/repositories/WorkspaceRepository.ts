import type {
	ProjectCapabilityKind,
	ProjectCodingEnvironment,
	WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "./BaseRepository";
import { AssistantError, ErrorType } from "~/utils/errors";

export interface WorkspaceRow {
	id: string;
	name: string;
	description: string;
	colour: string;
	created_by: number;
	created_at: string;
	updated_at: string | null;
}

export interface WorkspaceSummaryRow extends WorkspaceRow {
	role: WorkspaceRole;
	member_count: number;
	project_count: number;
}

export interface WorkspaceMemberRow {
	user_id: number;
	name: string | null;
	email: string;
	avatar_url: string | null;
	role: WorkspaceRole;
	joined_at: string;
}

export interface WorkspaceInvitationRow {
	id: string;
	workspace_id: string;
	email: string;
	role: Exclude<WorkspaceRole, "owner">;
	token_hash: string;
	status: "pending" | "accepted" | "revoked";
	invited_by: number;
	accepted_by: number | null;
	expires_at: string;
	accepted_at: string | null;
	created_at: string;
	updated_at: string | null;
}

export interface ProjectRow {
	id: string;
	workspace_id: string;
	name: string;
	description: string;
	instructions: string;
	colour: string;
	coding_enabled?: number;
	coding_installation_id?: number | null;
	coding_repository?: string | null;
	coding_prompt_strategy?: string;
	coding_should_commit?: number;
	coding_timeout_seconds?: number;
	created_by: number;
	archived_at: string | null;
	created_at: string;
	updated_at: string | null;
	conversation_count: number;
	capability_count: number;
}

export interface ProjectCapabilityRow {
	id: string;
	project_id: string;
	kind: ProjectCapabilityKind;
	capability_id: string;
	configuration: string | Record<string, unknown> | null;
	created_by: number;
	created_at: string;
}

export interface ProjectConversationRow {
	id: string;
	title: string | null;
	created_at: string;
	updated_at: string | null;
	last_message_at: string | null;
	message_count: number | null;
	created_by: number;
	created_by_name: string | null;
	created_by_avatar_url: string | null;
}

export class WorkspaceRepository extends BaseRepository {
	async createWorkspace(params: {
		id: string;
		name: string;
		description: string;
		colour: string;
		userId: number;
	}): Promise<void> {
		const database = this.env.DB;
		if (!database) return;

		await database.batch([
			database
				.prepare(
					`INSERT INTO workspace (id, name, description, colour, created_by)
					 VALUES (?, ?, ?, ?, ?)`,
				)
				.bind(params.id, params.name, params.description, params.colour, params.userId),
			database
				.prepare(
					`INSERT INTO workspace_member (workspace_id, user_id, role)
					 VALUES (?, ?, 'owner')`,
				)
				.bind(params.id, params.userId),
		]);
	}

	async listWorkspaces(userId: number): Promise<WorkspaceSummaryRow[]> {
		return this.runQuery<WorkspaceSummaryRow>(
			`SELECT w.*, wm.role,
				COUNT(DISTINCT members.user_id) AS member_count,
				COUNT(DISTINCT p.id) AS project_count
			 FROM workspace w
			 JOIN workspace_member wm ON wm.workspace_id = w.id AND wm.user_id = ?
			 LEFT JOIN workspace_member members ON members.workspace_id = w.id
			 LEFT JOIN project p ON p.workspace_id = w.id AND p.archived_at IS NULL
			 GROUP BY w.id, wm.role
			 ORDER BY w.updated_at DESC, w.created_at DESC`,
			[userId],
		);
	}

	async getWorkspace(workspaceId: string): Promise<WorkspaceRow | null> {
		return this.runQuery<WorkspaceRow>("SELECT * FROM workspace WHERE id = ?", [workspaceId], true);
	}

	async getMembership(
		workspaceId: string,
		userId: number,
	): Promise<{ role: WorkspaceRole } | null> {
		return this.runQuery<{ role: WorkspaceRole }>(
			"SELECT role FROM workspace_member WHERE workspace_id = ? AND user_id = ?",
			[workspaceId, userId],
			true,
		);
	}

	async listMembers(workspaceId: string): Promise<WorkspaceMemberRow[]> {
		return this.runQuery<WorkspaceMemberRow>(
			`SELECT u.id AS user_id, u.name, u.email, u.avatar_url, wm.role, wm.joined_at
			 FROM workspace_member wm
			 JOIN user u ON u.id = wm.user_id
			 WHERE wm.workspace_id = ?
			 ORDER BY CASE wm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.name, u.email`,
			[workspaceId],
		);
	}

	async updateMemberRole(
		workspaceId: string,
		userId: number,
		role: Exclude<WorkspaceRole, "owner">,
	): Promise<void> {
		await this.executeRun(
			"UPDATE workspace_member SET role = ? WHERE workspace_id = ? AND user_id = ?",
			[role, workspaceId, userId],
		);
	}

	async removeMember(workspaceId: string, userId: number): Promise<void> {
		await this.executeRun("DELETE FROM workspace_member WHERE workspace_id = ? AND user_id = ?", [
			workspaceId,
			userId,
		]);
	}

	async transferOwnership(
		workspaceId: string,
		currentOwnerUserId: number,
		newOwnerUserId: number,
	): Promise<void> {
		const result = await this.executeRun(
			`UPDATE workspace_member
			 SET role = CASE WHEN user_id = ? THEN 'admin' ELSE 'owner' END
			 WHERE workspace_id = ? AND user_id IN (?, ?)
			 AND (SELECT role FROM workspace_member WHERE workspace_id = ? AND user_id = ?) = 'owner'
			 AND (SELECT role FROM workspace_member WHERE workspace_id = ? AND user_id = ?) IN ('admin', 'member')`,
			[
				currentOwnerUserId,
				workspaceId,
				currentOwnerUserId,
				newOwnerUserId,
				workspaceId,
				currentOwnerUserId,
				workspaceId,
				newOwnerUserId,
			],
		);
		if (result.meta.changes !== 2) {
			throw new AssistantError(
				"Workspace ownership changed; reload and try again",
				ErrorType.CONFLICT_ERROR,
				409,
			);
		}
	}

	async updateWorkspace(workspaceId: string, updates: Record<string, unknown>): Promise<void> {
		const result = this.buildUpdateQuery(
			"workspace",
			updates,
			["name", "description", "colour"],
			"id = ?",
			[workspaceId],
		);
		if (result) await this.executeRun(result.query, result.values);
	}

	async deleteWorkspace(workspaceId: string): Promise<void> {
		const database = this.env.DB;
		if (!database) {
			throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
		}

		const projectIds = "SELECT id FROM project WHERE workspace_id = ?";
		const conversationIds = `SELECT id FROM conversation WHERE project_id IN (${projectIds})`;
		const taskIds = `SELECT id FROM tasks WHERE project_id IN (${projectIds})`;

		await database.batch([
			database
				.prepare(
					`UPDATE conversation
					 SET parent_conversation_id = NULL, parent_message_id = NULL
					 WHERE parent_conversation_id IN (${conversationIds})`,
				)
				.bind(workspaceId),
			database
				.prepare(`DELETE FROM training_examples WHERE conversation_id IN (${conversationIds})`)
				.bind(workspaceId),
			database
				.prepare(`DELETE FROM message WHERE conversation_id IN (${conversationIds})`)
				.bind(workspaceId),
			database
				.prepare(`DELETE FROM conversation WHERE project_id IN (${projectIds})`)
				.bind(workspaceId),
			database
				.prepare(`DELETE FROM task_executions WHERE task_id IN (${taskIds})`)
				.bind(workspaceId),
			database.prepare(`DELETE FROM tasks WHERE project_id IN (${projectIds})`).bind(workspaceId),
			database
				.prepare(`DELETE FROM template WHERE project_id IN (${projectIds})`)
				.bind(workspaceId),
			database.prepare("DELETE FROM workspace WHERE id = ?").bind(workspaceId),
		]);
	}

	async upsertInvitation(params: {
		id: string;
		workspaceId: string;
		email: string;
		role: Exclude<WorkspaceRole, "owner">;
		tokenHash: string;
		invitedBy: number;
		expiresAt: string;
	}): Promise<WorkspaceInvitationRow | null> {
		return this.runQuery<WorkspaceInvitationRow>(
			`INSERT INTO workspace_invitation
				(id, workspace_id, email, role, token_hash, status, invited_by, expires_at)
			 VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
			 ON CONFLICT(workspace_id, email) DO UPDATE SET
				id = excluded.id,
				role = excluded.role,
				token_hash = excluded.token_hash,
				status = 'pending',
				invited_by = excluded.invited_by,
				accepted_by = NULL,
				accepted_at = NULL,
				expires_at = excluded.expires_at,
				updated_at = CURRENT_TIMESTAMP
			 RETURNING *`,
			[
				params.id,
				params.workspaceId,
				params.email,
				params.role,
				params.tokenHash,
				params.invitedBy,
				params.expiresAt,
			],
			true,
		);
	}

	async listInvitations(workspaceId: string): Promise<WorkspaceInvitationRow[]> {
		return this.runQuery<WorkspaceInvitationRow>(
			"SELECT * FROM workspace_invitation WHERE workspace_id = ? ORDER BY created_at DESC",
			[workspaceId],
		);
	}

	async getInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitationRow | null> {
		return this.runQuery<WorkspaceInvitationRow>(
			"SELECT * FROM workspace_invitation WHERE token_hash = ?",
			[tokenHash],
			true,
		);
	}

	async acceptInvitation(invitation: WorkspaceInvitationRow, userId: number): Promise<void> {
		const database = this.env.DB;
		if (!database) {
			throw new AssistantError("Database not configured", ErrorType.CONFIGURATION_ERROR);
		}

		const [acceptResult, membershipResult] = await database.batch([
			database
				.prepare(
					`UPDATE workspace_invitation
					 SET status = 'accepted', accepted_by = ?, accepted_at = CURRENT_TIMESTAMP,
					     token_hash = 'consumed:' || id, updated_at = CURRENT_TIMESTAMP
					 WHERE id = ? AND status = 'pending' AND token_hash = ?`,
				)
				.bind(userId, invitation.id, invitation.token_hash),
			database
				.prepare(
					`INSERT INTO workspace_member (workspace_id, user_id, role)
					 SELECT workspace_id, ?, role
					 FROM workspace_invitation
					 WHERE id = ? AND status = 'accepted' AND accepted_by = ?
					 ON CONFLICT(workspace_id, user_id) DO NOTHING`,
				)
				.bind(userId, invitation.id, userId),
		]);

		if (!acceptResult.success || acceptResult.meta.changes !== 1 || !membershipResult.success) {
			throw new AssistantError(
				"Invitation is invalid or has already been used",
				ErrorType.CONFLICT_ERROR,
				409,
			);
		}
	}

	async revokeInvitation(workspaceId: string, invitationId: string): Promise<boolean> {
		const result = await this.executeRun(
			`UPDATE workspace_invitation
			 SET status = 'revoked', token_hash = 'revoked:' || id, updated_at = CURRENT_TIMESTAMP
			 WHERE id = ? AND workspace_id = ? AND status = 'pending'`,
			[invitationId, workspaceId],
		);
		return result.meta.changes > 0;
	}

	async createProject(params: {
		id: string;
		workspaceId: string;
		name: string;
		description: string;
		instructions: string;
		colour: string;
		codingEnvironment?: ProjectCodingEnvironment | null;
		createdBy: number;
	}): Promise<void> {
		await this.executeRun(
			`INSERT INTO project
				(id, workspace_id, name, description, instructions, colour,
				 coding_enabled, coding_installation_id, coding_repository,
				 coding_prompt_strategy, coding_should_commit, coding_timeout_seconds, created_by)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				params.id,
				params.workspaceId,
				params.name,
				params.description,
				params.instructions,
				params.colour,
				params.codingEnvironment ? 1 : 0,
				params.codingEnvironment?.installationId ?? null,
				params.codingEnvironment?.repository ?? null,
				params.codingEnvironment?.promptStrategy ?? "auto",
				params.codingEnvironment?.shouldCommit ?? true,
				params.codingEnvironment?.timeoutSeconds ?? 900,
				params.createdBy,
			],
		);
	}

	async createProjectWithCapabilities(
		params: Parameters<WorkspaceRepository["createProject"]>[0],
		capabilities: Array<{
			id: string;
			kind: ProjectCapabilityKind;
			capabilityId: string;
			configuration: Record<string, unknown>;
		}>,
	): Promise<void> {
		const database = this.env.DB;
		if (!database) return;
		await database.batch([
			database
				.prepare(
					`INSERT INTO project
					 (id, workspace_id, name, description, instructions, colour,
					  coding_enabled, coding_installation_id, coding_repository,
					  coding_prompt_strategy, coding_should_commit, coding_timeout_seconds, created_by)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.bind(
					params.id,
					params.workspaceId,
					params.name,
					params.description,
					params.instructions,
					params.colour,
					params.codingEnvironment ? 1 : 0,
					params.codingEnvironment?.installationId ?? null,
					params.codingEnvironment?.repository ?? null,
					params.codingEnvironment?.promptStrategy ?? "auto",
					params.codingEnvironment?.shouldCommit ?? true,
					params.codingEnvironment?.timeoutSeconds ?? 900,
					params.createdBy,
				),
			...capabilities.map((capability) =>
				database
					.prepare(
						`INSERT INTO project_capability
						 (id, project_id, kind, capability_id, configuration, created_by)
						 VALUES (?, ?, ?, ?, ?, ?)`,
					)
					.bind(
						capability.id,
						params.id,
						capability.kind,
						capability.capabilityId,
						JSON.stringify(capability.configuration),
						params.createdBy,
					),
			),
		]);
	}

	async listProjects(workspaceId: string): Promise<ProjectRow[]> {
		return this.runQuery<ProjectRow>(
			`SELECT p.*,
				COUNT(DISTINCT c.id) AS conversation_count,
				COUNT(DISTINCT pc.id) AS capability_count
			 FROM project p
			 LEFT JOIN conversation c ON c.project_id = p.id AND c.is_archived = 0
			 LEFT JOIN project_capability pc ON pc.project_id = p.id
			 WHERE p.workspace_id = ? AND p.archived_at IS NULL
			 GROUP BY p.id
			 ORDER BY p.updated_at DESC, p.created_at DESC`,
			[workspaceId],
		);
	}

	async getProject(projectId: string): Promise<ProjectRow | null> {
		return this.runQuery<ProjectRow>(
			`SELECT p.*,
				COUNT(DISTINCT c.id) AS conversation_count,
				COUNT(DISTINCT pc.id) AS capability_count
			 FROM project p
			 LEFT JOIN conversation c ON c.project_id = p.id AND c.is_archived = 0
			 LEFT JOIN project_capability pc ON pc.project_id = p.id
			 WHERE p.id = ? AND p.archived_at IS NULL
			 GROUP BY p.id`,
			[projectId],
			true,
		);
	}

	async updateProject(projectId: string, updates: Record<string, unknown>): Promise<void> {
		const result = this.buildUpdateQuery(
			"project",
			updates,
			[
				"name",
				"description",
				"instructions",
				"colour",
				"coding_enabled",
				"coding_installation_id",
				"coding_repository",
				"coding_prompt_strategy",
				"coding_should_commit",
				"coding_timeout_seconds",
				"archived_at",
			],
			"id = ?",
			[projectId],
		);
		if (result) await this.executeRun(result.query, result.values);
	}

	async listProjectCapabilities(projectId: string): Promise<ProjectCapabilityRow[]> {
		return this.runQuery<ProjectCapabilityRow>(
			"SELECT * FROM project_capability WHERE project_id = ? ORDER BY created_at",
			[projectId],
		);
	}

	async addProjectCapability(params: {
		id: string;
		projectId: string;
		kind: ProjectCapabilityKind;
		capabilityId: string;
		configuration: Record<string, unknown>;
		createdBy: number;
	}): Promise<void> {
		const result = await this.executeRun(
			`INSERT INTO project_capability
				(id, project_id, kind, capability_id, configuration, created_by)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(project_id, kind, capability_id) DO UPDATE SET
				configuration = excluded.configuration
			 WHERE project_capability.created_by = excluded.created_by`,
			[
				params.id,
				params.projectId,
				params.kind,
				params.capabilityId,
				JSON.stringify(params.configuration),
				params.createdBy,
			],
		);
		if (result.meta.changes === 0) {
			throw new AssistantError(
				"Only the member who attached this capability can manage it",
				ErrorType.FORBIDDEN,
				403,
			);
		}
	}

	async removeProjectCapability(projectId: string, capabilityId: string): Promise<void> {
		await this.executeRun("DELETE FROM project_capability WHERE project_id = ? AND id = ?", [
			projectId,
			capabilityId,
		]);
	}

	async listProjectConversations(projectId: string): Promise<ProjectConversationRow[]> {
		return this.runQuery<ProjectConversationRow>(
			`SELECT c.id, c.title, c.created_at, c.updated_at, c.last_message_at, c.message_count,
				u.id AS created_by, u.name AS created_by_name, u.avatar_url AS created_by_avatar_url
			 FROM conversation c
			 JOIN user u ON u.id = c.user_id
			 WHERE c.project_id = ? AND c.is_archived = 0
			 ORDER BY COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC
			 LIMIT 50`,
			[projectId],
		);
	}

	async canAccessConversation(conversationId: string, userId: number): Promise<boolean> {
		const row = await this.runQuery<{ allowed: number }>(
			`SELECT EXISTS(
				SELECT 1 FROM conversation c
				JOIN user access_user ON access_user.id = ?
				LEFT JOIN project p ON p.id = c.project_id
				LEFT JOIN workspace_member wm
					ON wm.workspace_id = p.workspace_id AND wm.user_id = access_user.id
				WHERE c.id = ? AND (
					(c.project_id IS NULL AND c.user_id = access_user.id)
					OR (
						c.project_id IS NOT NULL
						AND access_user.plan_id = 'pro'
						AND wm.user_id IS NOT NULL
					)
				)
			) AS allowed`,
			[userId, conversationId],
			true,
		);
		return row?.allowed === 1;
	}
}
