import { and, eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  workspaceProviderConnection,
  type WorkspaceProviderConnectionRow,
} from "~/infrastructure/database/schema";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";
import type { IEnv } from "~/types";

export type WorkspaceConnectionProvider = WorkspaceProviderConnectionRow["provider"];

export interface WorkspaceProviderConnection {
  account: string | null;
  config: Record<string, string>;
  updatedAt: string;
  updatedBy: number | null;
}

export class WorkspaceProviderConnectionRepository extends BaseRepository<
  Pick<IEnv, "DB" | "PRIVATE_KEY">
> {
  private async find(workspaceId: string, provider: WorkspaceConnectionProvider) {
    const [row] = await this.database
      .select()
      .from(workspaceProviderConnection)
      .where(
        and(
          eq(workspaceProviderConnection.workspace_id, workspaceId),
          eq(workspaceProviderConnection.provider, provider),
        ),
      )
      .limit(1);

    return row ?? null;
  }

  async getConnection(
    workspaceId: string,
    provider: WorkspaceConnectionProvider,
  ): Promise<WorkspaceProviderConnection | null> {
    const row = await this.find(workspaceId, provider);

    return row
      ? {
          account: row.account,
          config: row.config,
          updatedAt: row.updated_at,
          updatedBy: row.updated_by,
        }
      : null;
  }

  async getSecret(
    workspaceId: string,
    provider: WorkspaceConnectionProvider,
  ): Promise<string | null> {
    const row = await this.find(workspaceId, provider);

    return row ? openSecret(this.env, row.encrypted_secret) : null;
  }

  async saveConnection(input: {
    workspaceId: string;
    provider: WorkspaceConnectionProvider;
    secret: string;
    account: string | null;
    config: Record<string, string>;
    updatedBy: number;
  }): Promise<void> {
    const values = {
      encrypted_secret: await sealSecret(this.env, input.secret),
      account: input.account,
      config: input.config,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    };

    await this.database
      .insert(workspaceProviderConnection)
      .values({ workspace_id: input.workspaceId, provider: input.provider, ...values })
      .onConflictDoUpdate({
        target: [workspaceProviderConnection.workspace_id, workspaceProviderConnection.provider],
        set: values,
      });
  }

  async deleteConnection(
    workspaceId: string,
    provider: WorkspaceConnectionProvider,
  ): Promise<boolean> {
    const deleted = await this.database
      .delete(workspaceProviderConnection)
      .where(
        and(
          eq(workspaceProviderConnection.workspace_id, workspaceId),
          eq(workspaceProviderConnection.provider, provider),
        ),
      )
      .returning({ provider: workspaceProviderConnection.provider });

    return deleted.length > 0;
  }
}
