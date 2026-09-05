import type {
  ConversationType,
  ModelRouterMode,
  ProjectCapabilityKind,
  ProjectCodingEnvironment,
  WorkspaceRole,
} from "@ngriffin_uk/polychat-schemas";
import { sandboxDeliveryPolicyCreatesCommit } from "@ngriffin_uk/polychat-schemas";

import { AssistantError, ErrorType } from "~/utils/errors";
import { escapeSqlLikePattern } from "~/utils/sql";

import { BaseRepository } from "./BaseRepository";
import { buildCapabilityConfigurationUpsert } from "./CapabilityConfigurationRepository";
import { buildOwnedProjectCapabilityConfigurationUpsert } from "./projectCapabilityConfigurationStatements";

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

export interface GlobalWorkspaceSearchRow {
  id: string;
  name: string;
  description: string;
  updated_at: string | null;
}

export interface GlobalProjectSearchRow extends GlobalWorkspaceSearchRow {
  workspace_id: string;
  workspace_name: string;
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
  default_router_mode?: ModelRouterMode;
  coding_enabled?: number;
  coding_installation_id?: number | null;
  coding_repository?: string | null;
  coding_prompt_strategy?: string;
  coding_should_commit?: number;
  coding_delivery_policy?: string | null;
  coding_environment_setup?: string | null;
  coding_environment_cache?: string | null;
  coding_cache_generation?: number;
  coding_timeout_seconds?: number;
  flow?: string | null;
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

export interface ProjectReferenceRow {
  id: string;
  name: string;
}

export interface ProjectConversationRow {
  id: string;
  type: ConversationType;
  title: string | null;
  created_at: string;
  updated_at: string | null;
  last_message_at: string | null;
  message_count: number | null;
  created_by: number;
  created_by_name: string | null;
  created_by_avatar_url: string | null;
  is_pinned: number;
  is_unread: number;
  snoozed_until: string | null;
  snoozed_next_response_at: string | null;
  next_response_arrived: number;
  group: string | null;
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

    if (!database) {
      return;
    }

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

  async searchWorkspaces(
    userId: number,
    query: string,
    limit: number,
  ): Promise<GlobalWorkspaceSearchRow[]> {
    const trimmedQuery = query.trim();
    const searchTerm = `%${escapeSqlLikePattern(trimmedQuery)}%`;

    return this.runQuery<GlobalWorkspaceSearchRow>(
      `SELECT w.id, w.name, w.description, w.updated_at
			 FROM workspace w
			 JOIN workspace_member wm ON wm.workspace_id = w.id AND wm.user_id = ?
			 WHERE (? = '' OR w.name LIKE ? ESCAPE '\\' OR w.description LIKE ? ESCAPE '\\')
			 ORDER BY COALESCE(w.updated_at, w.created_at) DESC, w.id DESC
			 LIMIT ?`,
      [userId, trimmedQuery, searchTerm, searchTerm, limit],
    );
  }

  async searchProjects(
    userId: number,
    query: string,
    limit: number,
  ): Promise<GlobalProjectSearchRow[]> {
    const trimmedQuery = query.trim();
    const searchTerm = `%${escapeSqlLikePattern(trimmedQuery)}%`;

    return this.runQuery<GlobalProjectSearchRow>(
      `SELECT p.id, p.workspace_id, w.name AS workspace_name,
			        p.name, p.description, p.updated_at
			 FROM project p
			 JOIN workspace w ON w.id = p.workspace_id
			 JOIN workspace_member wm ON wm.workspace_id = w.id AND wm.user_id = ?
			 WHERE p.archived_at IS NULL
			   AND (? = '' OR p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')
			 ORDER BY COALESCE(p.updated_at, p.created_at) DESC, p.id DESC
			 LIMIT ?`,
      [userId, trimmedQuery, searchTerm, searchTerm, limit],
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

    if (result) {
      await this.executeRun(result.query, result.values);
    }
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
          `DELETE FROM capability_configuration
					 WHERE scope_type = 'project' AND scope_id IN (${projectIds})`,
        )
        .bind(workspaceId),
      database
        .prepare(
          `UPDATE usage_event
					 SET workspace_id = NULL, project_id = NULL
					 WHERE workspace_id = ?`,
        )
        .bind(workspaceId),
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
      database
        .prepare("DELETE FROM agents WHERE owner_scope_type = 'workspace' AND owner_scope_id = ?")
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
    defaultRouterMode?: ModelRouterMode;
    codingEnvironment?: ProjectCodingEnvironment | null;
    createdBy: number;
  }): Promise<void> {
    await this.executeRun(
      `INSERT INTO project
				(id, workspace_id, name, description, instructions, colour,
				 coding_enabled, coding_installation_id, coding_repository,
				 coding_prompt_strategy, coding_should_commit, coding_delivery_policy,
				 coding_environment_setup, coding_environment_cache, coding_cache_generation,
				 coding_timeout_seconds, created_by, default_router_mode)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        params.codingEnvironment
          ? sandboxDeliveryPolicyCreatesCommit(params.codingEnvironment.deliveryPolicy)
          : true,
        params.codingEnvironment ? JSON.stringify(params.codingEnvironment.deliveryPolicy) : null,
        params.codingEnvironment?.environmentSetup
          ? JSON.stringify(params.codingEnvironment.environmentSetup)
          : null,
        null,
        0,
        params.codingEnvironment?.timeoutSeconds ?? 900,
        params.createdBy,
        params.defaultRouterMode ?? "auto",
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

    if (!database) {
      return;
    }

    await database.batch([
      database
        .prepare(
          `INSERT INTO project
					 (id, workspace_id, name, description, instructions, colour,
					  coding_enabled, coding_installation_id, coding_repository,
					  coding_prompt_strategy, coding_should_commit, coding_delivery_policy,
					  coding_environment_setup, coding_environment_cache, coding_cache_generation,
					  coding_timeout_seconds, created_by, default_router_mode)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          params.codingEnvironment
            ? sandboxDeliveryPolicyCreatesCommit(params.codingEnvironment.deliveryPolicy)
            : true,
          params.codingEnvironment ? JSON.stringify(params.codingEnvironment.deliveryPolicy) : null,
          params.codingEnvironment?.environmentSetup
            ? JSON.stringify(params.codingEnvironment.environmentSetup)
            : null,
          null,
          0,
          params.codingEnvironment?.timeoutSeconds ?? 900,
          params.createdBy,
          params.defaultRouterMode ?? "auto",
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
            JSON.stringify({}),
            params.createdBy,
          ),
      ),
      ...capabilities.map((capability) => {
        const statement = buildCapabilityConfigurationUpsert({
          scope: { type: "project", id: params.id },
          capabilityKind: capability.kind,
          capabilityId: capability.capabilityId,
          configuration: capability.configuration,
        });

        return database.prepare(statement.query).bind(...statement.values);
      }),
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
        "default_router_mode",
        "coding_enabled",
        "coding_installation_id",
        "coding_repository",
        "coding_prompt_strategy",
        "coding_should_commit",
        "coding_delivery_policy",
        "coding_environment_setup",
        "coding_environment_cache",
        "coding_cache_generation",
        "coding_timeout_seconds",
        "flow",
        "archived_at",
      ],
      "id = ?",
      [projectId],
    );

    if (result) {
      await this.executeRun(result.query, result.values);
    }
  }

  async invalidateProjectEnvironmentCache(
    projectId: string,
    invalidatedCache: string | null,
  ): Promise<void> {
    await this.executeRun(
      `UPDATE project
       SET coding_environment_cache = ?,
           coding_cache_generation = coding_cache_generation + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [invalidatedCache, projectId],
    );
  }

  async storeProjectEnvironmentCache(
    projectId: string,
    expectedGeneration: number,
    cacheKey: string,
    cache: string,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE project
       SET coding_environment_cache = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND coding_cache_generation = ?
         AND (
           coding_environment_cache IS NULL
           OR json_valid(coding_environment_cache) = 0
           OR json_extract(
             CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
             END,
             '$.status'
           ) <> 'ready'
           OR json_extract(
             CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
             END,
             '$.cacheKey'
           ) <> ?
         )`,
      [cache, projectId, expectedGeneration, cacheKey],
    );

    return result.meta.changes > 0;
  }

  async touchProjectEnvironmentCache(
    projectId: string,
    expectedGeneration: number,
    backupId: string,
    cache: string,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE project
       SET coding_environment_cache = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND coding_cache_generation = ?
         AND json_extract(
           CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
           END,
           '$.status'
         ) = 'ready'
         AND json_extract(
           CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
           END,
           '$.backupId'
         ) = ?`,
      [cache, projectId, expectedGeneration, backupId],
    );

    return result.meta.changes > 0;
  }

  async replaceProjectEnvironmentCache(
    projectId: string,
    expectedGeneration: number,
    expectedBackupId: string,
    cache: string,
  ): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE project
       SET coding_environment_cache = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND coding_cache_generation = ?
         AND json_extract(
           CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
           END,
           '$.status'
         ) = 'ready'
         AND json_extract(
           CASE WHEN json_valid(coding_environment_cache) THEN coding_environment_cache ELSE '{}'
           END,
           '$.backupId'
         ) = ?`,
      [cache, projectId, expectedGeneration, expectedBackupId],
    );

    return result.meta.changes > 0;
  }

  async listProjectCapabilities(projectId: string): Promise<ProjectCapabilityRow[]> {
    return this.runQuery<ProjectCapabilityRow>(
      `SELECT pc.id, pc.project_id, pc.kind, pc.capability_id,
				COALESCE(cc.configuration, pc.configuration) AS configuration,
				pc.created_by, pc.created_at
			 FROM project_capability pc
			 LEFT JOIN capability_configuration cc
				ON cc.scope_type = 'project'
				AND cc.scope_id = pc.project_id
				AND cc.capability_kind = pc.kind
				AND cc.capability_id = pc.capability_id
			 WHERE pc.project_id = ?
			 ORDER BY pc.created_at`,
      [projectId],
    );
  }

  async listProjectsWithCapability(
    kind: ProjectCapabilityKind,
    capabilityId: string,
  ): Promise<ProjectReferenceRow[]> {
    return this.runQuery<ProjectReferenceRow>(
      `SELECT DISTINCT p.id, p.name
			 FROM project p
			 JOIN project_capability pc ON pc.project_id = p.id
			 WHERE pc.kind = ? AND pc.capability_id = ? AND p.archived_at IS NULL
			 ORDER BY p.name`,
      [kind, capabilityId],
    );
  }

  async listProjectsWithFlowStageAgent(agentId: string): Promise<ProjectReferenceRow[]> {
    return this.runQuery<ProjectReferenceRow>(
      `SELECT p.id, p.name
			 FROM project p
			 WHERE p.archived_at IS NULL
				AND p.flow IS NOT NULL
				AND json_valid(p.flow)
				AND EXISTS (
					SELECT 1 FROM json_each(p.flow, '$.stages') stage
					WHERE json_extract(stage.value, '$.agentId') = ?
				)
			 ORDER BY p.name`,
      [agentId],
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
    const database = this.env.DB;

    if (!database) {
      return;
    }

    const configurationStatement = buildOwnedProjectCapabilityConfigurationUpsert({
      scope: { type: "project", id: params.projectId },
      capabilityKind: params.kind,
      capabilityId: params.capabilityId,
      configuration: params.configuration,
      createdBy: params.createdBy,
    });
    const results = await database.batch([
      database
        .prepare(
          `INSERT INTO project_capability
						(id, project_id, kind, capability_id, configuration, created_by)
					 VALUES (?, ?, ?, ?, ?, ?)
					 ON CONFLICT(project_id, kind, capability_id) DO UPDATE SET
						created_by = project_capability.created_by
					 WHERE project_capability.kind = 'tool'
						OR project_capability.created_by = excluded.created_by`,
        )
        .bind(
          params.id,
          params.projectId,
          params.kind,
          params.capabilityId,
          JSON.stringify({}),
          params.createdBy,
        ),
      database.prepare(configurationStatement.query).bind(...configurationStatement.values),
    ]);

    if (results[0]?.meta.changes === 0) {
      throw new AssistantError(
        "Only the member who attached this capability can manage it",
        ErrorType.FORBIDDEN,
        403,
      );
    }
  }

  async removeProjectCapability(projectId: string, capabilityId: string): Promise<void> {
    const database = this.env.DB;

    if (!database) {
      return;
    }

    await database.batch([
      database
        .prepare(
          `DELETE FROM capability_configuration
					 WHERE scope_type = 'project' AND scope_id = ?
						AND EXISTS (
							SELECT 1 FROM project_capability pc
							WHERE pc.id = ?
								AND pc.project_id = capability_configuration.scope_id
								AND pc.kind = capability_configuration.capability_kind
								AND pc.capability_id = capability_configuration.capability_id
						)`,
        )
        .bind(projectId, capabilityId),
      database
        .prepare("DELETE FROM project_capability WHERE project_id = ? AND id = ?")
        .bind(projectId, capabilityId),
    ]);
  }

  async listProjectConversations(
    projectId: string,
    userId: number,
  ): Promise<ProjectConversationRow[]> {
    return this.runQuery<ProjectConversationRow>(
      `SELECT c.id, c.type, c.title, c.created_at, c.updated_at, c.last_message_at, c.message_count,
				u.id AS created_by, u.name AS created_by_name, u.avatar_url AS created_by_avatar_url,
        COALESCE(state.is_pinned, 0) AS is_pinned,
        COALESCE(state.is_unread, 0) AS is_unread,
        state.snoozed_until,
        state.snoozed_next_response_at,
        EXISTS (
          SELECT 1 FROM message response
          WHERE response.conversation_id = c.id
            AND response.role = 'assistant'
            AND state.snoozed_next_response_at IS NOT NULL
            AND julianday(response.created_at) > julianday(state.snoozed_next_response_at)
        ) AS next_response_arrived,
        (
          SELECT json_object(
            'id', grp.id,
            'name', grp.name,
            'scope', json_object('kind', 'project', 'projectId', grp.project_id)
          )
          FROM conversation_group_membership membership
          JOIN conversation_group grp ON grp.id = membership.group_id
          WHERE membership.conversation_id = c.id AND grp.project_id = c.project_id
        ) AS "group"
			 FROM conversation c
			 JOIN user u ON u.id = c.user_id
			 LEFT JOIN conversation_user_state state
         ON state.conversation_id = c.id AND state.user_id = ?
			 WHERE c.project_id = ? AND c.is_archived = 0
        AND NOT (
          COALESCE(datetime(state.snoozed_until) > datetime('now'), 0)
          OR (
            state.snoozed_next_response_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM message response
              WHERE response.conversation_id = c.id
                AND response.role = 'assistant'
                AND julianday(response.created_at) > julianday(state.snoozed_next_response_at)
            )
          )
        )
			 ORDER BY COALESCE(state.is_pinned, 0) DESC,
        COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC, c.id DESC
			 LIMIT 50`,
      [userId, projectId],
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
