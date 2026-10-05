import type { ConnectionCapabilities, ModelProviderId } from "@ngriffin_uk/polychat-schemas";
import { parseRecordValue } from "@ngriffin_uk/polychat-utility-core";
import { and, eq } from "drizzle-orm";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import {
  type WorkspaceProviderConnectionRecord,
  workspaceProviderConnection,
  workspaceProviderConnectionValues,
  workspaceProviderConnectionChanges,
} from "~/infrastructure/database/model-storage";
import { modelConfiguration } from "~/infrastructure/database/schema";
import { openSecret, sealSecret } from "~/infrastructure/secret-envelope";
import type { IEnv } from "~/types";

export interface ModelConnectionRecord {
  provider: ModelProviderId;
  account: string | null;
  config: Record<string, string>;
  secretKeys: string[];
  capabilities: ConnectionCapabilities;
  updatedAt: string;
  updatedBy: number | null;
}

export class ModelConnectionRepository extends BaseRepository<Pick<IEnv, "DB" | "PRIVATE_KEY">> {
  private async rows(workspaceId: string, provider?: ModelProviderId) {
    const conditions = [eq(workspaceProviderConnection.workspace_id, workspaceId)];

    if (provider) {
      conditions.push(eq(workspaceProviderConnection.provider, provider));
    }

    return this.database
      .select(workspaceProviderConnection)
      .from(modelConfiguration)
      .where(and(eq(modelConfiguration.kind, "connection"), and(...conditions)));
  }

  private async openSecrets(envelope: string): Promise<Record<string, string>> {
    const parsed = parseRecordValue(await openSecret(this.env, envelope));

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }

  private async toRecord(row: WorkspaceProviderConnectionRecord): Promise<ModelConnectionRecord> {
    return {
      provider: row.provider,
      account: row.account,
      config: row.config,
      secretKeys: Object.keys(await this.openSecrets(row.encrypted_secret)).sort(),
      capabilities: row.capabilities,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by,
    };
  }

  async listConnections(workspaceId: string): Promise<ModelConnectionRecord[]> {
    return Promise.all((await this.rows(workspaceId)).map((row) => this.toRecord(row)));
  }

  async getConnection(
    workspaceId: string,
    provider: ModelProviderId,
  ): Promise<ModelConnectionRecord | null> {
    const [row] = await this.rows(workspaceId, provider);

    return row ? this.toRecord(row) : null;
  }

  async getSecrets(
    workspaceId: string,
    provider: ModelProviderId,
  ): Promise<Record<string, string>> {
    const [row] = await this.rows(workspaceId, provider);

    return row ? this.openSecrets(row.encrypted_secret) : {};
  }

  async saveConnection(input: {
    workspaceId: string;
    provider: ModelProviderId;
    secrets: Record<string, string>;
    account: string | null;
    config: Record<string, string>;
    capabilities: ConnectionCapabilities;
    updatedBy: number;
  }): Promise<void> {
    const values = {
      encrypted_secret: await sealSecret(this.env, JSON.stringify(input.secrets)),
      account: input.account,
      config: input.config,
      capabilities: input.capabilities,
      updated_by: input.updatedBy,
      updated_at: new Date().toISOString(),
    };

    await this.database
      .insert(modelConfiguration)
      .values(
        workspaceProviderConnectionValues({
          workspace_id: input.workspaceId,
          provider: input.provider,
          ...values,
        }),
      )
      .onConflictDoUpdate({
        target: [
          modelConfiguration.workspace_id,
          modelConfiguration.kind,
          modelConfiguration.scope_key,
        ],
        set: workspaceProviderConnectionChanges(values),
      });
  }

  async deleteConnection(workspaceId: string, provider: ModelProviderId): Promise<boolean> {
    const deleted = await this.database
      .delete(modelConfiguration)
      .where(
        and(
          eq(modelConfiguration.kind, "connection"),
          and(
            eq(workspaceProviderConnection.workspace_id, workspaceId),
            eq(workspaceProviderConnection.provider, provider),
          ),
        ),
      )
      .returning({ provider: workspaceProviderConnection.provider });

    return deleted.length > 0;
  }

  async listConnectedWorkspaces(): Promise<string[]> {
    const rows = await this.database
      .selectDistinct({ workspaceId: workspaceProviderConnection.workspace_id })
      .from(modelConfiguration)
      .where(eq(modelConfiguration.kind, "connection"));

    return rows.map((row) => row.workspaceId);
  }
}
