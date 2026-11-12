import { BaseRepository } from "~/infrastructure/database/BaseRepository";
import type { ConversationRunEffectRow } from "~/infrastructure/database/schema";
import {
  PROCESS_BOUND_ABANDONED_REASON,
  PROCESS_BOUND_REFUSED_REASON,
  PROCESS_BOUND_RUN_EFFECT_KINDS,
  REPLAY_SAFE_RUN_EFFECT_KINDS,
  RUN_EFFECT_LEASE_MS,
  RUN_EFFECT_MAX_ATTEMPTS,
  runEffectRetryDelayMs,
  type ProcessBoundRunEffectKind,
} from "~/modules/conversations/domain/run-effects";
import type { IEnv } from "~/types";

const REPLAY_SAFE_SQL = REPLAY_SAFE_RUN_EFFECT_KINDS.map((kind) => `'${kind}'`).join(", ");
const PROCESS_BOUND_SQL = PROCESS_BOUND_RUN_EFFECT_KINDS.map((kind) => `'${kind}'`).join(", ");
const ERROR_MAX_CHARS = 500;

export interface RecoveredRunEffects {
  requeued: ConversationRunEffectRow[];
  cancelled: ConversationRunEffectRow[];
}

export class RunEffectRepository extends BaseRepository<Pick<IEnv, "DB">> {
  async recoverAbandoned(params: {
    conversationId: string;
    liveOwnerToken: string | null;
    now: Date;
  }): Promise<RecoveredRunEffects> {
    const now = params.now.toISOString();
    const requeued = await this.runQuery<ConversationRunEffectRow>(
      `UPDATE conversation_run_effect
       SET status = 'pending', lease_owner = NULL, lease_expires_at = NULL,
           available_at = ?, updated_at = ?
       WHERE conversation_id = ? AND status = 'running'
         AND kind IN (${REPLAY_SAFE_SQL})
         AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
       RETURNING *`,
      [now, now, params.conversationId, now],
    );
    const cancelled = await this.runQuery<ConversationRunEffectRow>(
      `UPDATE conversation_run_effect
       SET last_error = CASE status WHEN 'running' THEN ? ELSE ? END,
           status = 'cancelled', lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE conversation_id = ? AND status IN ('pending', 'running')
         AND kind IN (${PROCESS_BOUND_SQL})
         AND (owner_token IS NULL OR ? IS NULL OR owner_token <> ?)
       RETURNING *`,
      [
        PROCESS_BOUND_ABANDONED_REASON.running,
        PROCESS_BOUND_ABANDONED_REASON.pending,
        now,
        params.conversationId,
        params.liveOwnerToken,
        params.liveOwnerToken,
      ],
    );

    return { requeued, cancelled };
  }

  async claimNextReplaySafe(params: {
    conversationId: string;
    leaseOwner: string;
    now: Date;
  }): Promise<ConversationRunEffectRow | null> {
    const now = params.now.toISOString();
    const leaseExpiresAt = new Date(params.now.getTime() + RUN_EFFECT_LEASE_MS).toISOString();

    return this.runQuery<ConversationRunEffectRow>(
      `UPDATE conversation_run_effect
       SET status = 'running', lease_owner = ?, lease_expires_at = ?,
           attempt_count = attempt_count + 1, updated_at = ?
       WHERE id = (
         SELECT id FROM conversation_run_effect
         WHERE conversation_id = ? AND status = 'pending'
           AND kind IN (${REPLAY_SAFE_SQL}) AND available_at <= ?
         ORDER BY created_at ASC, id ASC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM conversation_run_effect
         WHERE conversation_id = ? AND status = 'running'
           AND kind IN (${REPLAY_SAFE_SQL}) AND lease_expires_at > ?
       )
       RETURNING *`,
      [
        params.leaseOwner,
        leaseExpiresAt,
        now,
        params.conversationId,
        now,
        params.conversationId,
        now,
      ],
      true,
    );
  }

  async succeed(effect: ConversationRunEffectRow, leaseOwner: string, now: Date): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE conversation_run_effect
       SET status = 'succeeded', lease_owner = NULL, lease_expires_at = NULL,
           last_error = NULL, updated_at = ?
       WHERE id = ? AND status = 'running' AND lease_owner = ?`,
      [now.toISOString(), effect.id, leaseOwner],
    );

    return (result.meta.changes ?? 0) > 0;
  }

  async retryOrFail(
    effect: ConversationRunEffectRow,
    leaseOwner: string,
    error: string,
    now: Date,
  ): Promise<ConversationRunEffectRow | null> {
    const exhausted = effect.attempt_count >= RUN_EFFECT_MAX_ATTEMPTS;
    const availableAt = new Date(
      now.getTime() + runEffectRetryDelayMs(effect.attempt_count),
    ).toISOString();

    return this.runQuery<ConversationRunEffectRow>(
      `UPDATE conversation_run_effect
       SET status = ?, available_at = ?, last_error = ?,
           lease_owner = NULL, lease_expires_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'running' AND lease_owner = ?
       RETURNING *`,
      [
        exhausted ? "failed" : "pending",
        exhausted ? effect.available_at : availableAt,
        error.slice(0, ERROR_MAX_CHARS),
        now.toISOString(),
        effect.id,
        leaseOwner,
      ],
      true,
    );
  }

  async nextDrainAt(conversationId: string): Promise<string | null> {
    const row = await this.runQuery<{
      next_pending: string | null;
      lease_expires_at: string | null;
    }>(
      `SELECT
         MIN(CASE WHEN status = 'pending' THEN available_at END) AS next_pending,
         MAX(CASE WHEN status = 'running' THEN lease_expires_at END) AS lease_expires_at
       FROM conversation_run_effect
       WHERE conversation_id = ? AND status IN ('pending', 'running')
         AND kind IN (${REPLAY_SAFE_SQL})`,
      [conversationId],
      true,
    );
    const candidates = [row?.next_pending, row?.lease_expires_at].filter((value): value is string =>
      Boolean(value),
    );

    return candidates.length
      ? candidates.reduce((latest, value) => (value > latest ? value : latest))
      : null;
  }

  async claimProcessBound(params: {
    runId: string;
    runAttempt: number;
    kind: ProcessBoundRunEffectKind;
    ownerToken: string;
    now: Date;
  }): Promise<ConversationRunEffectRow | null> {
    const now = params.now.toISOString();

    return this.runQuery<ConversationRunEffectRow>(
      `UPDATE conversation_run_effect
       SET status = 'running', lease_owner = owner_token,
           attempt_count = attempt_count + 1, updated_at = ?
       WHERE run_id = ? AND run_attempt = ? AND kind = ?
         AND status = 'pending' AND owner_token = ?
         AND EXISTS (
           SELECT 1 FROM conversation_run
           WHERE id = conversation_run_effect.run_id
             AND attempt = conversation_run_effect.run_attempt
             AND status = 'running'
         )
       RETURNING *`,
      [now, params.runId, params.runAttempt, params.kind, params.ownerToken],
      true,
    );
  }

  async settleProcessBound(params: {
    id: string;
    ownerToken: string;
    outcome: "succeeded" | "failed";
    error?: string;
    now: Date;
  }): Promise<boolean> {
    const result = await this.executeRun(
      `UPDATE conversation_run_effect
       SET status = ?, last_error = ?, lease_owner = NULL, updated_at = ?
       WHERE id = ? AND status = 'running' AND owner_token = ?`,
      [
        params.outcome,
        params.error?.slice(0, ERROR_MAX_CHARS) ?? null,
        params.now.toISOString(),
        params.id,
        params.ownerToken,
      ],
    );

    return (result.meta.changes ?? 0) > 0;
  }

  async refuseProcessBound(params: {
    runId: string;
    runAttempt: number;
    kind: ProcessBoundRunEffectKind;
    ownerToken: string;
    now: Date;
  }): Promise<void> {
    await this.executeRun(
      `UPDATE conversation_run_effect
       SET status = 'cancelled', last_error = ?, lease_owner = NULL, updated_at = ?
       WHERE run_id = ? AND run_attempt = ? AND kind = ? AND status = 'pending'
         AND owner_token = ?`,
      [
        PROCESS_BOUND_REFUSED_REASON,
        params.now.toISOString(),
        params.runId,
        params.runAttempt,
        params.kind,
        params.ownerToken,
      ],
    );
  }

  async listConversationsNeedingDrain(params: {
    staleBefore: Date;
    limit: number;
  }): Promise<string[]> {
    const rows = await this.runQuery<{ conversation_id: string }>(
      `SELECT DISTINCT conversation_id FROM conversation_run_effect
       WHERE status IN ('pending', 'running') AND updated_at <= ?
       LIMIT ?`,
      [params.staleBefore.toISOString(), params.limit],
    );

    return rows.map((row) => row.conversation_id);
  }
}
