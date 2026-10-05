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
    }[]
  > {
    return this.runQuery(
      `SELECT connection.id AS connection_id, connection.workspace_id, workspace.name AS workspace_name,
         connection.label, connection.enabled
       FROM enterprise_identity_connection connection
       JOIN workspace ON workspace.id = connection.workspace_id
       JOIN oauth_account identity ON identity.provider_id = 'enterprise-' || connection.id AND identity.user_id = ?
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
       JOIN workspace_member member ON member.workspace_id = w.id
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
       AND EXISTS (SELECT 1 FROM workspace_member member
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
       AND EXISTS (SELECT 1 FROM workspace_member member
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
}
