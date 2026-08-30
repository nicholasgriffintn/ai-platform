import type {
  ConversationLock,
  ConversationLockKey,
  ConversationLockKeyInput,
  LockedMessage,
  LockedMessageInput,
  SealedEnvelope,
} from "@ngriffin_uk/polychat-schemas";

import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

interface ConversationLockRow {
  conversation_id: string;
  version: number;
  title_envelope: string | null;
  created_at: string;
  updated_at: string | null;
}

interface ConversationLockKeyRow {
  id: string;
  conversation_id: string;
  type: ConversationLockKey["type"];
  credential_id: string | null;
  label: string | null;
  salt: string;
  kdf: ConversationLockKey["kdf"];
  kdf_iterations: number | null;
  wrapped_key: string;
  created_at: string;
  last_used_at: string | null;
}

interface LockedMessageRow {
  id: string;
  conversation_id: string;
  seq: number;
  role: LockedMessage["role"];
  envelope: string;
  created_at: string;
}

function readEnvelope(value: string | null): SealedEnvelope | null {
  if (!value) {
    return null;
  }

  if (typeof value === "object") {
    return value as SealedEnvelope;
  }

  return safeParseJson<SealedEnvelope>(value) ?? null;
}

function formatKey(row: ConversationLockKeyRow): ConversationLockKey {
  return {
    id: row.id,
    type: row.type,
    credential_id: row.credential_id,
    label: row.label,
    salt: row.salt,
    kdf: row.kdf,
    kdf_iterations: row.kdf_iterations,
    wrapped_key: readEnvelope(row.wrapped_key) as SealedEnvelope,
    created_at: row.created_at,
    last_used_at: row.last_used_at,
  };
}

function formatMessage(row: LockedMessageRow): LockedMessage {
  return {
    id: row.id,
    seq: row.seq,
    role: row.role,
    envelope: readEnvelope(row.envelope) as SealedEnvelope,
    created_at: row.created_at,
  };
}

export class ConversationLockRepository extends BaseRepository {
  public async getLock(conversationId: string): Promise<ConversationLock | null> {
    const row = await this.runQuery<ConversationLockRow>(
      "SELECT * FROM conversation_lock WHERE conversation_id = ?",
      [conversationId],
      true,
    );

    if (!row) {
      return null;
    }

    const keys = await this.runQuery<ConversationLockKeyRow>(
      "SELECT * FROM conversation_lock_key WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
      [conversationId],
    );

    return {
      conversation_id: row.conversation_id,
      version: row.version,
      title: readEnvelope(row.title_envelope),
      keys: keys.map(formatKey),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  public async isLocked(conversationId: string): Promise<boolean> {
    const row = await this.runQuery<{ conversation_id: string }>(
      "SELECT conversation_id FROM conversation_lock WHERE conversation_id = ?",
      [conversationId],
      true,
    );

    return Boolean(row);
  }

  public async createLock(params: {
    conversationId: string;
    version: number;
    title: SealedEnvelope | null;
    keys: ConversationLockKeyInput[];
    messages: LockedMessageInput[];
  }): Promise<void> {
    const database = this.env.DB;
    const statements = [
      database
        .prepare(
          `INSERT INTO conversation_lock (conversation_id, version, title_envelope, created_at, updated_at)
					 VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
        )
        .bind(
          params.conversationId,
          params.version,
          params.title ? JSON.stringify(params.title) : null,
        ),
      database
        .prepare("UPDATE conversation SET locked_at = datetime('now'), title = NULL WHERE id = ?")
        .bind(params.conversationId),
    ];

    for (const key of params.keys) {
      statements.push(this.insertKeyStatement(params.conversationId, key));
    }

    for (const message of params.messages) {
      statements.push(this.insertMessageStatement(params.conversationId, message));
    }

    await database.batch(statements);
  }

  private insertKeyStatement(conversationId: string, key: ConversationLockKeyInput) {
    return this.env.DB.prepare(
      `INSERT INTO conversation_lock_key
			   (id, conversation_id, type, credential_id, label, salt, kdf, kdf_iterations, wrapped_key, created_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).bind(
      generateId(),
      conversationId,
      key.type,
      key.credential_id ?? null,
      key.label ?? null,
      key.salt,
      key.kdf ?? null,
      key.kdf_iterations ?? null,
      JSON.stringify(key.wrapped_key),
    );
  }

  private insertMessageStatement(conversationId: string, message: LockedMessageInput) {
    return this.env.DB.prepare(
      `INSERT INTO locked_message (id, conversation_id, seq, role, envelope, created_at)
			 VALUES (?, ?, ?, ?, ?, datetime('now'))
			 ON CONFLICT(conversation_id, seq) DO UPDATE SET
			   id = excluded.id,
			   role = excluded.role,
			   envelope = excluded.envelope`,
    ).bind(message.id, conversationId, message.seq, message.role, JSON.stringify(message.envelope));
  }

  public async addKey(conversationId: string, key: ConversationLockKeyInput): Promise<void> {
    await this.insertKeyStatement(conversationId, key).run();
  }

  public async deleteKey(conversationId: string, keyId: string): Promise<number> {
    const result = await this.executeRun(
      "DELETE FROM conversation_lock_key WHERE conversation_id = ? AND id = ?",
      [conversationId, keyId],
    );

    return result?.meta?.changes ?? 0;
  }

  public async countKeys(conversationId: string): Promise<number> {
    const row = await this.runQuery<{ total: number }>(
      "SELECT COUNT(*) as total FROM conversation_lock_key WHERE conversation_id = ?",
      [conversationId],
      true,
    );

    return row?.total ?? 0;
  }

  public async markKeyUsed(conversationId: string, keyId: string): Promise<void> {
    await this.executeRun(
      "UPDATE conversation_lock_key SET last_used_at = datetime('now') WHERE conversation_id = ? AND id = ?",
      [conversationId, keyId],
    );
  }

  public async listMessages(conversationId: string): Promise<LockedMessage[]> {
    const rows = await this.runQuery<LockedMessageRow>(
      "SELECT * FROM locked_message WHERE conversation_id = ? ORDER BY seq ASC",
      [conversationId],
    );

    return rows.map(formatMessage);
  }

  public async appendMessages(
    conversationId: string,
    messages: LockedMessageInput[],
    title: SealedEnvelope | null | undefined,
  ): Promise<void> {
    const database = this.env.DB;
    const statements = messages.map((message) =>
      this.insertMessageStatement(conversationId, message),
    );

    if (title !== undefined) {
      statements.push(
        database
          .prepare(
            "UPDATE conversation_lock SET title_envelope = ?, updated_at = datetime('now') WHERE conversation_id = ?",
          )
          .bind(title ? JSON.stringify(title) : null, conversationId),
      );
    }

    statements.push(
      database
        .prepare(
          `UPDATE conversation
					 SET message_count = (SELECT COUNT(*) FROM locked_message WHERE conversation_id = ?),
					     last_message_at = datetime('now'),
					     updated_at = datetime('now')
					 WHERE id = ?`,
        )
        .bind(conversationId, conversationId),
    );

    await database.batch(statements);
  }

  public async deleteLock(conversationId: string): Promise<void> {
    const database = this.env.DB;

    await database.batch([
      database.prepare("DELETE FROM locked_message WHERE conversation_id = ?").bind(conversationId),
      database
        .prepare("DELETE FROM conversation_lock_key WHERE conversation_id = ?")
        .bind(conversationId),
      database
        .prepare("DELETE FROM conversation_lock WHERE conversation_id = ?")
        .bind(conversationId),
      database
        .prepare(
          "UPDATE conversation SET locked_at = NULL, updated_at = datetime('now') WHERE id = ?",
        )
        .bind(conversationId),
    ]);
  }
}
