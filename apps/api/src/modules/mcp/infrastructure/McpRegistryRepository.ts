import { generateId } from "@ngriffin_uk/polychat-utility-core";
import { AssistantError, ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface McpServerRecord {
  id: string;
  created_by_user_id: number;
  workspace_id: string | null;
  label: string;
  endpoint: string;
  enabled: boolean | number;
  revision: number;
  tools: string;
}

export interface McpConnectionRecord {
  id: string;
  user_id: number;
  server_id: string;
  revision: number;
  encrypted_credential: string;
  shared_projects: string;
}

const visibleServer = `(workspace_id IS NULL AND created_by_user_id = ? OR EXISTS (
  SELECT 1 FROM active_workspace_member m JOIN user u ON u.id = m.user_id
  WHERE m.workspace_id = native_mcp_server.workspace_id AND m.user_id = ? AND u.plan_id = 'pro'
))`;

const managedServer = `(workspace_id IS NULL AND created_by_user_id = ? OR EXISTS (
  SELECT 1 FROM active_workspace_member m JOIN user u ON u.id = m.user_id
  WHERE m.workspace_id = native_mcp_server.workspace_id AND m.user_id = ?
    AND m.role IN ('owner', 'admin') AND u.plan_id = 'pro'
))`;

export class McpRegistryRepository extends BaseRepository {
  getServer(id: string, userId: number) {
    return this.runQuery<McpServerRecord>(
      `SELECT * FROM native_mcp_server WHERE id = ? AND ${visibleServer}`,
      [id, userId, userId],
      true,
    );
  }

  listServers(userId: number, workspaceId?: string) {
    return this.runQuery<McpServerRecord>(
      `SELECT * FROM native_mcp_server WHERE ${visibleServer}
      AND ${workspaceId ? "workspace_id = ?" : "workspace_id IS NULL"} ORDER BY label, id LIMIT 100`,
      [userId, userId, ...(workspaceId ? [workspaceId] : [])],
    );
  }

  async createServer(input: {
    userId: number;
    workspaceId?: string;
    label: string;
    endpoint: string;
  }) {
    const id = generateId();
    const result = await this.runQuery<{ id: string }>(
      `INSERT INTO native_mcp_server
      (id, created_by_user_id, workspace_id, label, endpoint)
      SELECT ?, ?, ?, ?, ? WHERE ? IS NULL OR EXISTS (
        SELECT 1 FROM active_workspace_member m JOIN user u ON u.id = m.user_id
        WHERE m.workspace_id = ? AND m.user_id = ? AND m.role IN ('owner', 'admin') AND u.plan_id = 'pro'
      ) RETURNING id`,
      [
        id,
        input.userId,
        input.workspaceId ?? null,
        input.label,
        input.endpoint,
        input.workspaceId ?? null,
        input.workspaceId ?? null,
        input.userId,
      ],
      true,
    );

    this.requireChange(result);

    return id;
  }

  async updateServer(
    id: string,
    userId: number,
    revision: number,
    tools: string,
    enabled: boolean,
  ) {
    const result = await this.runQuery<{ id: string }>(
      `UPDATE native_mcp_server SET tools = ?, enabled = ?, revision = revision + 1
      WHERE id = ? AND revision = ? AND ${managedServer} RETURNING id`,
      [tools, Number(enabled), id, revision, userId, userId],
      true,
    );

    this.requireChange(result);
  }

  async deleteServer(id: string, userId: number, revision: number) {
    const result = await this.runQuery<{ id: string }>(
      `DELETE FROM native_mcp_server WHERE id = ? AND revision = ? AND ${managedServer} RETURNING id`,
      [id, revision, userId, userId],
      true,
    );

    this.requireChange(result);
  }

  getConnection(serverId: string, userId: number) {
    return this.runQuery<McpConnectionRecord>(
      `SELECT * FROM native_mcp_connection WHERE server_id = ? AND user_id = ?`,
      [serverId, userId],
      true,
    );
  }

  listConnections(userId: number, workspaceId?: string) {
    return this.runQuery<McpConnectionRecord>(
      `SELECT connection.* FROM native_mcp_connection connection
      JOIN native_mcp_server ON native_mcp_server.id = connection.server_id
      WHERE connection.user_id = ? AND ${visibleServer}
        AND ${workspaceId ? "workspace_id = ?" : "workspace_id IS NULL"}
      ORDER BY label, native_mcp_server.id LIMIT 100`,
      [userId, userId, userId, ...(workspaceId ? [workspaceId] : [])],
    );
  }

  async saveConnection(input: {
    serverId: string;
    userId: number;
    serverRevision: number;
    id: string;
    previousRevision?: number;
    encryptedCredential: string;
    sharedProjects: string;
  }) {
    const visible = `EXISTS (SELECT 1 FROM native_mcp_server WHERE id = ? AND revision = ? AND ${visibleServer}
      AND NOT EXISTS (
        SELECT 1 FROM json_each(?) requested WHERE NOT EXISTS (
          SELECT 1 FROM project p JOIN active_workspace_member m ON m.workspace_id = p.workspace_id
          JOIN user u ON u.id = m.user_id
          WHERE p.id = requested.value AND p.workspace_id = native_mcp_server.workspace_id
            AND m.user_id = ? AND u.plan_id = 'pro'
        )
      ))`;
    const result =
      input.previousRevision === undefined
        ? await this.runQuery<{ id: string }>(
            `INSERT INTO native_mcp_connection (id, user_id, server_id, encrypted_credential, shared_projects)
        SELECT ?, ?, ?, ?, ? WHERE ${visible} RETURNING id`,
            [
              input.id,
              input.userId,
              input.serverId,
              input.encryptedCredential,
              input.sharedProjects,
              input.serverId,
              input.serverRevision,
              input.userId,
              input.userId,
              input.sharedProjects,
              input.userId,
            ],
            true,
          )
        : await this.runQuery<{ id: string }>(
            `UPDATE native_mcp_connection SET encrypted_credential = ?, shared_projects = ?, revision = revision + 1
        WHERE id = ? AND user_id = ? AND revision = ? AND ${visible} RETURNING id`,
            [
              input.encryptedCredential,
              input.sharedProjects,
              input.id,
              input.userId,
              input.previousRevision,
              input.serverId,
              input.serverRevision,
              input.userId,
              input.userId,
              input.sharedProjects,
              input.userId,
            ],
            true,
          );

    this.requireChange(result);
  }

  async deleteConnection(serverId: string, userId: number) {
    await this.executeRun("DELETE FROM native_mcp_connection WHERE server_id = ? AND user_id = ?", [
      serverId,
      userId,
    ]);
  }

  private requireChange(result: { id: string } | null) {
    if (!result) {
      throw new AssistantError(
        "MCP authority or configuration changed. Refresh and try again.",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }
  }
}
