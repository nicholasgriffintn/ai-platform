import type { ChatRunStatus } from "@ngriffin_uk/polychat-schemas";
import { generateId } from "@ngriffin_uk/polychat-utility-core";

import type { RunEffectKind } from "~/modules/conversations/domain/run-effects";

export interface RunEffectEnqueue {
  kind: RunEffectKind;
  runId: string;
  runAttempt: number;
  now: string;
  actorUserId?: number | null;
  ownerToken?: string | null;
  whenRunStatusIn?: readonly ChatRunStatus[];
}

export function buildEnqueueRunEffectStatement(
  database: D1Database,
  effect: RunEffectEnqueue,
): D1PreparedStatement {
  const statuses = effect.whenRunStatusIn ?? [];
  const statusClause = statuses.length
    ? ` AND status IN (${statuses.map(() => "?").join(", ")})`
    : "";

  return database
    .prepare(
      `INSERT OR IGNORE INTO conversation_run_effect (
         id, conversation_id, run_id, run_attempt, kind, actor_user_id, owner_token,
         status, attempt_count, available_at, created_at, updated_at
       )
       SELECT ?, conversation_id, id, attempt, ?, ?, ?, 'pending', 0, ?, ?, ?
       FROM conversation_run
       WHERE id = ? AND attempt = ?${statusClause}`,
    )
    .bind(
      `effect_${generateId()}`,
      effect.kind,
      effect.actorUserId ?? null,
      effect.ownerToken ?? null,
      effect.now,
      effect.now,
      effect.now,
      effect.runId,
      effect.runAttempt,
      ...statuses,
    );
}
