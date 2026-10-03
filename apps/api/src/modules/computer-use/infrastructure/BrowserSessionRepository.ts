import type { BrowserCredentialSource, BrowserProvider } from "@ngriffin_uk/polychat-schemas";

import { BaseRepository } from "~/infrastructure/database/BaseRepository";

export interface BrowserSessionRecord {
  id: string;
  user_id: number;
  conversation_id: string;
  workspace_id: string | null;
  provider: BrowserProvider;
  credential_source: BrowserCredentialSource;
  provider_session_id: string | null;
  tool_call_id: string;
  input_hash: string;
  creation_claimed: number;
  creation_started_at: number | null;
  last_error: string | null;
  model: string;
  destroyed_at: string | null;
}

export class BrowserSessionRepository extends BaseRepository {
  async get(id: string): Promise<BrowserSessionRecord | null> {
    return this.runQuery<BrowserSessionRecord>(
      "SELECT * FROM browser_session WHERE id = ?",
      [id],
      true,
    );
  }

  async reserve(
    input: Omit<
      BrowserSessionRecord,
      | "provider_session_id"
      | "destroyed_at"
      | "creation_claimed"
      | "creation_started_at"
      | "last_error"
    >,
  ): Promise<BrowserSessionRecord> {
    await this.runQuery(
      "INSERT OR IGNORE INTO browser_session (id, user_id, conversation_id, workspace_id, provider, credential_source, tool_call_id, model, input_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        input.id,
        input.user_id,
        input.conversation_id,
        input.workspace_id,
        input.provider,
        input.credential_source,
        input.tool_call_id,
        input.model,
        input.input_hash,
      ],
    );
    const record = await this.runQuery<BrowserSessionRecord>(
      "SELECT * FROM browser_session WHERE user_id = ? AND conversation_id = ? AND tool_call_id = ?",
      [input.user_id, input.conversation_id, input.tool_call_id],
      true,
    );

    if (!record) {
      throw new Error("Browser session could not be reserved");
    }

    return record;
  }

  async bind(id: string, providerSessionId: string): Promise<void> {
    await this.runQuery(
      "UPDATE browser_session SET provider_session_id = ? WHERE id = ? AND provider_session_id IS NULL AND destroyed_at IS NULL",
      [providerSessionId, id],
    );
  }

  async claimCreation(id: string): Promise<boolean> {
    const claimed = await this.runQuery<{ id: string }>(
      "UPDATE browser_session SET creation_claimed = 1, creation_started_at = ? WHERE id = ? AND creation_claimed = 0 AND destroyed_at IS NULL RETURNING id",
      [Date.now(), id],
      true,
    );

    return Boolean(claimed);
  }

  async setStartupError(id: string): Promise<void> {
    await this.runQuery("UPDATE browser_session SET last_error = ? WHERE id = ?", [
      "Browser startup could not be confirmed. Refresh to recover the same session before trying another task.",
      id,
    ]);
  }

  async markDestroyed(id: string): Promise<void> {
    await this.runQuery(
      "UPDATE browser_session SET destroyed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [id],
    );
  }
}
