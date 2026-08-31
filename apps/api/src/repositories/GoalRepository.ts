import {
  isConversationOwner,
  type Goal,
  type GoalEvidenceEntry,
  type GoalOwner,
  type GoalProgressEntry,
  type GoalSource,
  type GoalStatus,
} from "@ngriffin_uk/polychat-schemas";

import { generateId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

interface GoalRow {
  id: string;
  conversation_id: string | null;
  sandbox_run_id: string | null;
  user_id: number;
  objective: string;
  status: GoalStatus;
  source: GoalSource;
  iteration_count: number;
  stall_streak: number;
  tokens_spent: number;
  progress: string | null;
  evidence: string | null;
  stopped_reason: string | null;
  created_from_message_id: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at: string | null;
  last_continued_at: string | null;
}

export interface CreateGoalParams {
  owner: GoalOwner;
  userId: number;
  objective: string;
  source: GoalSource;
  createdFromMessageId?: string;
}

export interface UpdateGoalParams {
  status?: GoalStatus;
  objective?: string;
  iterationCount?: number;
  stallStreak?: number;
  tokensSpent?: number;
  progress?: GoalProgressEntry[];
  evidence?: GoalEvidenceEntry[];
  stoppedReason?: string | null;
  completedAt?: string | null;
  lastContinuedAt?: string | null;
}

export interface UpdateGoalOptions {
  expectedStatus?: GoalStatus;
}

function formatGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sandbox_run_id: row.sandbox_run_id,
    user_id: row.user_id,
    objective: row.objective,
    status: row.status,
    source: row.source,
    iteration_count: row.iteration_count,
    stall_streak: row.stall_streak,
    tokens_spent: row.tokens_spent,
    progress: row.progress ? (safeParseJson<GoalProgressEntry[]>(row.progress) ?? []) : [],
    evidence: row.evidence ? safeParseJson<GoalEvidenceEntry[]>(row.evidence) : null,
    stopped_reason: row.stopped_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
    last_continued_at: row.last_continued_at,
  };
}

function ownerColumn(owner: GoalOwner): "conversation_id" | "sandbox_run_id" {
  return isConversationOwner(owner) ? "conversation_id" : "sandbox_run_id";
}

function ownerValue(owner: GoalOwner): string {
  return isConversationOwner(owner) ? owner.conversationId : owner.sandboxRunId;
}

export class GoalRepository extends BaseRepository {
  async getActiveGoal(owner: GoalOwner): Promise<Goal | null> {
    const row = await this.runQuery<GoalRow>(
      `SELECT * FROM goal
       WHERE ${ownerColumn(owner)} = ?
         AND status IN ('active', 'paused')
       ORDER BY created_at DESC
       LIMIT 1`,
      [ownerValue(owner)],
      true,
    );

    return row ? formatGoal(row) : null;
  }

  async getGoalById(id: string): Promise<Goal | null> {
    const row = await this.runQuery<GoalRow>("SELECT * FROM goal WHERE id = ?", [id], true);

    return row ? formatGoal(row) : null;
  }

  async listGoals(owner: GoalOwner, limit = 20): Promise<Goal[]> {
    const rows = await this.runQuery<GoalRow>(
      `SELECT * FROM goal WHERE ${ownerColumn(owner)} = ? ORDER BY created_at DESC LIMIT ?`,
      [ownerValue(owner), limit],
    );

    return rows.map(formatGoal);
  }

  async createGoal(params: CreateGoalParams): Promise<Goal> {
    const id = generateId();
    const conversationId = isConversationOwner(params.owner) ? params.owner.conversationId : null;
    const sandboxRunId = isConversationOwner(params.owner) ? null : params.owner.sandboxRunId;

    const row = await this.runQuery<GoalRow>(
      `INSERT INTO goal
        (id, conversation_id, sandbox_run_id, user_id, objective, status, source, progress, created_from_message_id)
       VALUES (?, ?, ?, ?, ?, 'active', ?, '[]', ?)
       RETURNING *`,
      [
        id,
        conversationId,
        sandboxRunId,
        params.userId,
        params.objective,
        params.source,
        params.createdFromMessageId ?? null,
      ],
      true,
    );

    return formatGoal(row);
  }

  async updateGoal(
    id: string,
    updates: UpdateGoalParams,
    options: UpdateGoalOptions = {},
  ): Promise<Goal | null> {
    const columns: string[] = [];
    const values: unknown[] = [];

    const set = (column: string, value: unknown) => {
      columns.push(`${column} = ?`);
      values.push(value);
    };

    if (updates.status !== undefined) {
      set("status", updates.status);
    }

    if (updates.objective !== undefined) {
      set("objective", updates.objective);
    }

    if (updates.iterationCount !== undefined) {
      set("iteration_count", updates.iterationCount);
    }

    if (updates.stallStreak !== undefined) {
      set("stall_streak", updates.stallStreak);
    }

    if (updates.tokensSpent !== undefined) {
      set("tokens_spent", updates.tokensSpent);
    }

    if (updates.progress !== undefined) {
      set("progress", JSON.stringify(updates.progress));
    }

    if (updates.evidence !== undefined) {
      set("evidence", JSON.stringify(updates.evidence));
    }

    if (updates.stoppedReason !== undefined) {
      set("stopped_reason", updates.stoppedReason);
    }

    if (updates.completedAt !== undefined) {
      set("completed_at", updates.completedAt);
    }

    if (updates.lastContinuedAt !== undefined) {
      set("last_continued_at", updates.lastContinuedAt);
    }

    if (columns.length === 0) {
      return this.getGoalById(id);
    }

    columns.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    if (options.expectedStatus !== undefined) {
      values.push(options.expectedStatus);
    }

    const row = await this.runQuery<GoalRow>(
      `UPDATE goal SET ${columns.join(", ")} WHERE id = ?${
        options.expectedStatus === undefined ? "" : " AND status = ?"
      } RETURNING *`,
      values,
      true,
    );

    return row ? formatGoal(row) : null;
  }
}
