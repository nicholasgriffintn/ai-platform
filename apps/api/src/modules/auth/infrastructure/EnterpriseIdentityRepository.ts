import type { OidcConnection } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { EnterpriseIdentityConnectionRow } from "~/infrastructure/database/schema";
import type { User } from "~/types";

export class EnterpriseIdentityRepository extends BaseRepository {
  listLinkedForUser(userId: number): Promise<
    {
      connection_id: string;
      workspace_id: string;
      workspace_name: string;
      label: string;
      enabled: number;
      identity_lease_expires_at: string | null;
    }[]
  > {
    return this.runQuery(
      `SELECT connection.id AS connection_id, connection.workspace_id, workspace.name AS workspace_name,
         connection.label, connection.enabled, member.identity_lease_expires_at
       FROM enterprise_identity_connection connection
       JOIN workspace ON workspace.id = connection.workspace_id
       JOIN oauth_account identity ON identity.provider_id = 'enterprise-' || connection.id AND identity.user_id = ?
       LEFT JOIN active_workspace_member member ON member.workspace_id = connection.workspace_id AND member.user_id = identity.user_id
       ORDER BY workspace.name, connection.label`,
      [userId],
    );
  }

  getById(id: string): Promise<EnterpriseIdentityConnectionRow | null> {
    return this.runQuery<EnterpriseIdentityConnectionRow>(
      "SELECT * FROM enterprise_identity_connection WHERE id = ?",
      [id],
      true,
    );
  }

  getForWorkspace(workspaceId: string): Promise<EnterpriseIdentityConnectionRow | null> {
    return this.runQuery<EnterpriseIdentityConnectionRow>(
      "SELECT * FROM enterprise_identity_connection WHERE workspace_id = ?",
      [workspaceId],
      true,
    );
  }

  async create(
    connection: OidcConnection,
    encryptedSecret: string,
    actorId: number,
  ): Promise<void> {
    await this.executeRun(
      `INSERT INTO enterprise_identity_connection
       (id, workspace_id, label, issuer, client_id, encrypted_secret, configuration, created_by, enabled)
       SELECT ?, w.id, ?, ?, ?, ?, ?, ?, ? FROM workspace w
       JOIN active_workspace_member member ON member.workspace_id = w.id
       WHERE w.id = ? AND member.user_id = ? AND member.role = 'owner'`,
      [
        connection.id,
        connection.label,
        connection.issuer,
        connection.clientId,
        encryptedSecret,
        JSON.stringify(connection),
        actorId,
        connection.enabled ? 1 : 0,
        connection.workspaceId,
        actorId,
      ],
    );
  }

  update(
    connection: OidcConnection,
    encryptedSecret: string,
    actorId: number,
  ): Promise<EnterpriseIdentityConnectionRow | null> {
    return this.runQuery<EnterpriseIdentityConnectionRow>(
      `UPDATE enterprise_identity_connection SET label = ?, configuration = ?, encrypted_secret = ?,
         enabled = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND workspace_id = ? AND revision = ?
       AND EXISTS (SELECT 1 FROM active_workspace_member member
         WHERE member.workspace_id = enterprise_identity_connection.workspace_id
         AND member.user_id = ? AND member.role = 'owner')
       RETURNING *`,
      [
        connection.label,
        JSON.stringify(connection),
        encryptedSecret,
        connection.enabled ? 1 : 0,
        connection.id,
        connection.workspaceId,
        connection.revision - 1,
        actorId,
      ],
      true,
    );
  }

  async delete(id: string, workspaceId: string, actorId: number): Promise<boolean> {
    const deleted = await this.runQuery<{ id: string }>(
      `DELETE FROM enterprise_identity_connection WHERE id = ? AND workspace_id = ?
       AND EXISTS (SELECT 1 FROM active_workspace_member member
         WHERE member.workspace_id = ? AND member.user_id = ? AND member.role = 'owner')
       RETURNING id`,
      [id, workspaceId, workspaceId, actorId],
      true,
    );

    return deleted?.id === id;
  }

  async createUserForSubject(
    connection: OidcConnection,
    params: {
      subject: string;
      email: string;
      name?: string;
    },
  ): Promise<User | null> {
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT INTO user (email, name) VALUES (?, ?)").bind(
        params.email,
        params.name ?? null,
      ),
      this.env.DB.prepare(
        "INSERT INTO oauth_account (provider_id, provider_user_id, user_id) SELECT ?, ?, id FROM user WHERE email = ?",
      ).bind(`enterprise-${connection.id}`, params.subject, params.email),
    ]);

    return this.runQuery<User>(
      `SELECT u.* FROM user u JOIN oauth_account identity ON identity.user_id = u.id
       WHERE identity.provider_id = ? AND identity.provider_user_id = ?`,
      [`enterprise-${connection.id}`, params.subject],
      true,
    );
  }

  async linkSubject(connection: OidcConnection, subject: string, userId: number): Promise<void> {
    await this.executeRun(
      "INSERT INTO oauth_account (provider_id, provider_user_id, user_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
      [`enterprise-${connection.id}`, subject, userId],
    );
  }

  async grantMembership(params: {
    connection: OidcConnection;
    userId: number;
    role: "admin" | "member";
    expiresAt: string;
  }): Promise<boolean> {
    const { connection, userId, role, expiresAt } = params;
    const row = await this.runQuery<{ user_id: number }>(
      `INSERT INTO workspace_member (workspace_id, user_id, role, managed_connection_id,
         managed_connection_revision, identity_lease_expires_at)
       SELECT workspace_id, ?, ?, id, revision, ? FROM enterprise_identity_connection
       WHERE id = ? AND workspace_id = ? AND revision = ? AND enabled = 1
         AND julianday(?) > julianday('now')
       ON CONFLICT(workspace_id, user_id) DO UPDATE SET
         role = excluded.role, managed_connection_id = excluded.managed_connection_id,
         managed_connection_revision = excluded.managed_connection_revision,
         identity_lease_expires_at = excluded.identity_lease_expires_at
       WHERE (workspace_member.managed_connection_id = excluded.managed_connection_id
         OR (workspace_member.managed_connection_id IS NOT NULL AND NOT EXISTS (
           SELECT 1 FROM enterprise_identity_connection previous
           WHERE previous.id = workspace_member.managed_connection_id)))
         AND workspace_member.role <> 'owner'
       RETURNING user_id`,
      [
        userId,
        role,
        expiresAt,
        connection.id,
        connection.workspaceId,
        connection.revision,
        expiresAt,
      ],
      true,
    );

    if (row) {
      return true;
    }

    const manual = await this.runQuery<{ user_id: number }>(
      `SELECT user_id FROM active_workspace_member WHERE workspace_id = ? AND user_id = ?
       AND managed_connection_id IS NULL
       AND EXISTS (SELECT 1 FROM enterprise_identity_connection WHERE id = ? AND enabled = 1 AND revision = ?)`,
      [connection.workspaceId, userId, connection.id, connection.revision],
      true,
    );

    return Boolean(manual);
  }

  async revokeSubjectMembership(connection: OidcConnection, subject: string): Promise<void> {
    await this.executeRun(
      `DELETE FROM workspace_member WHERE workspace_id = ? AND managed_connection_id = ?
       AND user_id IN (SELECT user_id FROM oauth_account WHERE provider_id = ? AND provider_user_id = ?)`,
      [connection.workspaceId, connection.id, `enterprise-${connection.id}`, subject],
    );
  }
}
