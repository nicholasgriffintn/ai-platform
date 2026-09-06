import {
  CHAT_RUN_PROTOCOL_VERSION,
  canTransitionChatRun,
  chatContextSnapshotSchema,
  chatRetrySnapshotSchema,
  isTerminalChatRunStatus,
  type ChatContextSnapshot,
  type ChatRetrySnapshot,
  type ChatRun,
  type ChatRunCommandKind,
  type ChatRunCommandReceipt,
  type ChatRunEvent,
  type ChatRunStatus,
} from "@ngriffin_uk/polychat-schemas";

import {
  buildInsertRunEventStatement,
  buildInsertRetryRunEventStatement,
  buildTrimRunEventsStatement,
} from "~/lib/chat-runs/event-statements";
import type { ConversationRunEventRow, ConversationRunRow } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

interface CommandReceiptRow extends ConversationRunRow {
  command_id: string;
  command_kind: ChatRunCommandKind;
  input_digest: string;
  accepted_at: string;
}

export interface AcceptRunCommandParams {
  commandId: string;
  conversationId: string;
  digest: string;
  kind: ChatRunCommandKind;
  userId: number;
  projectId?: string | null;
  projectTaskId?: string | null;
  stageId?: string | null;
  runId?: string;
}

export interface AcceptRunCancellationParams {
  commandId: string;
  digest: string;
  expectedAttempt: number;
  runId: string;
  userId: number;
}

function formatRun(row: ConversationRunRow): ChatRun {
  let context: ChatContextSnapshot | null = null;
  let retry: ChatRetrySnapshot | null = null;

  if (row.context_json) {
    try {
      const parsed = chatContextSnapshotSchema.safeParse(JSON.parse(row.context_json));

      context = parsed.success ? parsed.data : null;
    } catch {
      context = null;
    }
  }

  if (row.retry_json) {
    try {
      const parsed = chatRetrySnapshotSchema.safeParse(JSON.parse(row.retry_json));

      retry = parsed.success ? parsed.data : null;
    } catch {
      retry = null;
    }
  }

  return {
    protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
    id: row.id,
    conversationId: row.conversation_id,
    projectId: row.project_id,
    projectTaskId: row.project_task_id,
    stageId: row.stage_id,
    initiatorUserId: row.initiator_user_id,
    status: row.status,
    attempt: row.attempt,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    cancellationRequestedAt: row.cancellation_requested_at,
    terminalReason: row.terminal_reason,
    lastMessageId: row.last_message_id,
    context,
    retry,
  };
}

function formatReceipt(row: CommandReceiptRow, duplicate: boolean): ChatRunCommandReceipt {
  return {
    protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
    commandId: row.command_id,
    run: formatRun(row),
    kind: row.command_kind,
    acceptedAt: row.accepted_at,
    duplicate,
  };
}

function formatEvent(row: ConversationRunEventRow): ChatRunEvent {
  let data: Record<string, unknown> = {};

  try {
    const parsed = JSON.parse(row.data) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      data = parsed as Record<string, unknown>;
    }
  } catch {
    data = {};
  }

  return {
    protocolVersion: row.protocol_version,
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    attempt: row.attempt,
    type: row.type,
    occurredAt: row.occurred_at,
    data,
  };
}

function assertCompatibleCommand(row: CommandReceiptRow, params: AcceptRunCommandParams): void {
  if (
    row.conversation_id !== params.conversationId ||
    row.command_kind !== params.kind ||
    row.input_digest !== params.digest ||
    (params.runId !== undefined && row.id !== params.runId)
  ) {
    throw new AssistantError(
      "This command id was already used with different input",
      ErrorType.CONFLICT_ERROR,
      409,
    );
  }
}

export class ConversationRunRepository extends BaseRepository {
  async getById(runId: string): Promise<ChatRun | null> {
    const row = await this.runQuery<ConversationRunRow>(
      "SELECT * FROM conversation_run WHERE id = ?",
      [runId],
      true,
    );

    return row ? formatRun(row) : null;
  }

  async getLatestForConversation(conversationId: string): Promise<ChatRun | null> {
    const row = await this.runQuery<ConversationRunRow>(
      `SELECT * FROM conversation_run
       WHERE conversation_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [conversationId],
      true,
    );

    return row ? formatRun(row) : null;
  }

  async updateContext(
    runId: string,
    attempt: number,
    context: ChatContextSnapshot,
  ): Promise<ChatRun | null> {
    const row = await this.runQuery<ConversationRunRow>(
      `UPDATE conversation_run
       SET context_json = ?, updated_at = ?
       WHERE id = ? AND attempt = ?
         AND status IN ('accepted', 'running', 'awaiting_input', 'awaiting_approval', 'cancelling')
       RETURNING *`,
      [JSON.stringify(context), context.generatedAt, runId, attempt],
      true,
    );

    return row ? formatRun(row) : null;
  }

  async updateRetry(
    runId: string,
    attempt: number,
    retry: ChatRetrySnapshot | null,
  ): Promise<ChatRun | null> {
    const now = new Date().toISOString();
    const retryJson = retry ? JSON.stringify(retry) : null;
    const update = this.env.DB.prepare(
      `UPDATE conversation_run
       SET retry_json = ?, updated_at = ?, event_sequence = event_sequence + 1
       WHERE id = ? AND attempt = ? AND status = 'running'
       RETURNING *`,
    ).bind(retryJson, now, runId, attempt);
    const event = {
      id: `event_${generateId()}`,
      runId,
      type: "run.retry_changed",
      occurredAt: now,
      data: { retry },
      expectedAttempt: attempt,
    };
    const [result] = await this.env.DB.batch([
      update,
      buildInsertRetryRunEventStatement(this.env.DB, event, retryJson),
      buildTrimRunEventsStatement(this.env.DB, runId),
    ]);
    const row = result.results[0] as ConversationRunRow | undefined;

    return row ? formatRun(row) : null;
  }

  async listForProjectTask(projectId: string, projectTaskId: string): Promise<ChatRun[]> {
    const rows = await this.runQuery<ConversationRunRow>(
      `SELECT * FROM conversation_run
       WHERE project_id = ? AND project_task_id = ?
       ORDER BY created_at ASC, id ASC`,
      [projectId, projectTaskId],
    );

    return rows.map(formatRun);
  }

  async getEventCursor(runId: string): Promise<number> {
    const row = await this.runQuery<{ event_sequence: number }>(
      "SELECT event_sequence FROM conversation_run WHERE id = ?",
      [runId],
      true,
    );

    return row?.event_sequence ?? 0;
  }

  async getEventWindow(runId: string): Promise<{ oldest: number | null; latest: number }> {
    const row = await this.runQuery<{
      oldest_sequence: number | null;
      latest_sequence: number;
    }>(
      `SELECT MIN(e.sequence) AS oldest_sequence, r.event_sequence AS latest_sequence
       FROM conversation_run r
       LEFT JOIN conversation_run_event e ON e.run_id = r.id
       WHERE r.id = ?
       GROUP BY r.id`,
      [runId],
      true,
    );

    return {
      oldest:
        row?.oldest_sequence === null || row?.oldest_sequence === undefined
          ? null
          : row.oldest_sequence,
      latest: row?.latest_sequence ?? 0,
    };
  }

  async listEvents(runId: string, after: number, limit: number): Promise<ChatRunEvent[]> {
    const rows = await this.runQuery<ConversationRunEventRow>(
      `SELECT * FROM conversation_run_event
       WHERE run_id = ? AND sequence > ?
       ORDER BY sequence ASC
       LIMIT ?`,
      [runId, after, limit],
    );

    return rows.map(formatEvent);
  }

  async getForInteraction(conversationId: string, interactionId: string): Promise<ChatRun | null> {
    const row = await this.runQuery<ConversationRunRow>(
      `SELECT r.* FROM message m
       JOIN conversation_run r ON r.id = m.run_id
       WHERE m.conversation_id = ?
         AND m.tool_call_id = ?
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 1`,
      [conversationId, interactionId],
      true,
    );

    return row ? formatRun(row) : null;
  }

  private async getCommand(userId: number, commandId: string): Promise<CommandReceiptRow | null> {
    return this.runQuery<CommandReceiptRow>(
      `SELECT r.*, c.command_id, c.kind AS command_kind, c.input_digest, c.accepted_at
       FROM conversation_run_command c
       JOIN conversation_run r ON r.id = c.run_id
       WHERE c.user_id = ? AND c.command_id = ?`,
      [userId, commandId],
      true,
    );
  }

  async findCommandReceipt(params: AcceptRunCommandParams): Promise<ChatRunCommandReceipt | null> {
    const existing = await this.getCommand(params.userId, params.commandId);

    if (!existing) {
      return null;
    }

    assertCompatibleCommand(existing, params);

    return formatReceipt(existing, true);
  }

  async getCommandReceipt(
    userId: number,
    commandId: string,
  ): Promise<ChatRunCommandReceipt | null> {
    const command = await this.getCommand(userId, commandId);

    return command ? formatReceipt(command, true) : null;
  }

  private async acceptNewRun(params: AcceptRunCommandParams): Promise<ChatRunCommandReceipt> {
    const now = new Date().toISOString();
    const runId = `run_${generateId()}`;
    const runStatement = this.env.DB.prepare(
      `INSERT INTO conversation_run (
         id, conversation_id, project_id, project_task_id, stage_id, initiator_user_id,
         status, attempt, event_sequence, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'accepted', 1, 1, ?, ?)
       RETURNING *`,
    ).bind(
      runId,
      params.conversationId,
      params.projectId ?? null,
      params.projectTaskId ?? null,
      params.stageId ?? null,
      params.userId,
      now,
      now,
    );
    const commandStatement = this.env.DB.prepare(
      `INSERT INTO conversation_run_command (
         id, run_id, user_id, command_id, kind, input_digest, accepted_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
    ).bind(generateId(), runId, params.userId, params.commandId, params.kind, params.digest, now);
    const event = {
      id: `event_${generateId()}`,
      runId,
      type: "run.accepted",
      occurredAt: now,
      data: { status: "accepted" },
      expectedAttempt: 1,
    };

    try {
      const [runResult] = await this.env.DB.batch([
        runStatement,
        commandStatement,
        buildInsertRunEventStatement(this.env.DB, event),
        buildTrimRunEventsStatement(this.env.DB, runId),
      ]);
      const row = runResult.results[0] as ConversationRunRow | undefined;

      if (!row) {
        throw new AssistantError("Failed to accept the run", ErrorType.DATABASE_ERROR);
      }

      return {
        protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
        commandId: params.commandId,
        run: formatRun(row),
        kind: params.kind,
        acceptedAt: now,
        duplicate: false,
      };
    } catch (error) {
      const raced = await this.getCommand(params.userId, params.commandId);

      if (!raced) {
        throw error;
      }

      assertCompatibleCommand(raced, params);

      return formatReceipt(raced, true);
    }
  }

  private async acceptResume(
    params: AcceptRunCommandParams & { runId: string },
  ): Promise<ChatRunCommandReceipt> {
    const current = await this.getById(params.runId);

    if (
      !current ||
      current.conversationId !== params.conversationId ||
      current.projectId !== (params.projectId ?? null) ||
      current.projectTaskId !== (params.projectTaskId ?? null) ||
      current.initiatorUserId !== params.userId ||
      (current.status !== "awaiting_input" && current.status !== "awaiting_approval")
    ) {
      throw new AssistantError(
        "This run cannot accept that response",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    const now = new Date().toISOString();
    const commandStatement = this.env.DB.prepare(
      `INSERT INTO conversation_run_command (
         id, run_id, user_id, command_id, kind, input_digest, accepted_at
       ) SELECT ?, id, ?, ?, ?, ?, ?
         FROM conversation_run
        WHERE id = ? AND attempt = ? AND status = ?
       RETURNING id`,
    ).bind(
      generateId(),
      params.userId,
      params.commandId,
      params.kind,
      params.digest,
      now,
      params.runId,
      current.attempt,
      current.status,
    );
    const nextAttempt = current.attempt + 1;
    const runStatement = this.env.DB.prepare(
      `UPDATE conversation_run
       SET status = 'running', attempt = attempt + 1, updated_at = ?,
           started_at = COALESCE(started_at, ?), terminal_reason = NULL,
           context_json = NULL, retry_json = NULL,
           event_sequence = event_sequence + 1
       WHERE id = ? AND attempt = ? AND status = ?
       RETURNING *`,
    ).bind(now, now, params.runId, current.attempt, current.status);

    try {
      const event = {
        id: `event_${generateId()}`,
        runId: params.runId,
        type: "run.status_changed",
        occurredAt: now,
        data: { previousStatus: current.status, status: "running" },
        expectedAttempt: nextAttempt,
      };
      const [commandResult, runResult] = await this.env.DB.batch([
        commandStatement,
        runStatement,
        buildInsertRunEventStatement(this.env.DB, event, { ignoreSequenceConflict: true }),
        buildTrimRunEventsStatement(this.env.DB, params.runId),
      ]);
      const command = commandResult.results[0];
      const row = runResult.results[0] as ConversationRunRow | undefined;

      if (!command || !row) {
        throw new AssistantError(
          "The run changed before this response was accepted",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      return {
        protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
        commandId: params.commandId,
        run: formatRun(row),
        kind: params.kind,
        acceptedAt: now,
        duplicate: false,
      };
    } catch (error) {
      const raced = await this.getCommand(params.userId, params.commandId);

      if (!raced) {
        throw error;
      }

      assertCompatibleCommand(raced, params);

      return formatReceipt(raced, true);
    }
  }

  async acceptCommand(params: AcceptRunCommandParams): Promise<ChatRunCommandReceipt> {
    const existing = await this.findCommandReceipt(params);

    if (existing) {
      return existing;
    }

    return params.runId
      ? this.acceptResume({ ...params, runId: params.runId })
      : this.acceptNewRun(params);
  }

  async acceptCancellation(params: AcceptRunCancellationParams): Promise<ChatRunCommandReceipt> {
    const compatibleParams: AcceptRunCommandParams = {
      commandId: params.commandId,
      conversationId: "",
      digest: params.digest,
      kind: "cancel",
      userId: params.userId,
      runId: params.runId,
    };
    const existing = await this.getCommand(params.userId, params.commandId);

    if (existing) {
      compatibleParams.conversationId = existing.conversation_id;
      assertCompatibleCommand(existing, compatibleParams);

      return formatReceipt(existing, true);
    }

    const current = await this.getById(params.runId);

    if (
      !current ||
      current.attempt !== params.expectedAttempt ||
      isTerminalChatRunStatus(current.status)
    ) {
      throw new AssistantError(
        "The run attempt changed before cancellation was accepted",
        ErrorType.CONFLICT_ERROR,
        409,
      );
    }

    compatibleParams.conversationId = current.conversationId;
    const now = new Date().toISOString();
    const nextStatus =
      current.status === "accepted" ||
      current.status === "awaiting_input" ||
      current.status === "awaiting_approval"
        ? "cancelled"
        : "cancelling";
    const commandStatement = this.env.DB.prepare(
      `INSERT INTO conversation_run_command (
         id, run_id, user_id, command_id, kind, input_digest, accepted_at
       ) SELECT ?, id, ?, ?, 'cancel', ?, ?
         FROM conversation_run
        WHERE id = ? AND attempt = ?
       RETURNING id`,
    ).bind(
      generateId(),
      params.userId,
      params.commandId,
      params.digest,
      now,
      params.runId,
      params.expectedAttempt,
    );
    const runStatement = this.env.DB.prepare(
      `UPDATE conversation_run
       SET status = CASE
             WHEN status IN ('accepted', 'awaiting_input', 'awaiting_approval') THEN 'cancelled'
             ELSE 'cancelling'
           END,
           updated_at = ?,
           completed_at = CASE
             WHEN status IN ('accepted', 'awaiting_input', 'awaiting_approval') THEN ?
             ELSE completed_at
           END,
           cancellation_requested_at = ?,
           event_sequence = event_sequence + 1
       WHERE id = ? AND attempt = ?
         AND status IN ('accepted', 'running', 'awaiting_input', 'awaiting_approval')
       RETURNING *`,
    ).bind(now, now, now, params.runId, params.expectedAttempt);

    try {
      const event = {
        id: `event_${generateId()}`,
        runId: params.runId,
        type: "run.status_changed",
        occurredAt: now,
        data: { previousStatus: current.status, status: nextStatus },
        expectedAttempt: params.expectedAttempt,
      };
      const statements = [
        commandStatement,
        runStatement,
        buildInsertRunEventStatement(this.env.DB, event, { ignoreSequenceConflict: true }),
        buildTrimRunEventsStatement(this.env.DB, params.runId),
      ];

      const [commandResult, runResult] = await this.env.DB.batch(statements);

      if (!commandResult.results[0]) {
        throw new AssistantError(
          "The run attempt changed before cancellation was accepted",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      const transitioned = runResult.results[0] as ConversationRunRow | undefined;
      const settled = transitioned ? formatRun(transitioned) : await this.getById(params.runId);

      if (!settled || settled.attempt !== params.expectedAttempt) {
        throw new AssistantError(
          "The run attempt changed before cancellation was accepted",
          ErrorType.CONFLICT_ERROR,
          409,
        );
      }

      return {
        protocolVersion: CHAT_RUN_PROTOCOL_VERSION,
        commandId: params.commandId,
        run: settled,
        kind: "cancel",
        acceptedAt: now,
        duplicate: false,
      };
    } catch (error) {
      const raced = await this.getCommand(params.userId, params.commandId);

      if (!raced) {
        throw error;
      }

      assertCompatibleCommand(raced, compatibleParams);

      return formatReceipt(raced, true);
    }
  }

  async transition(params: {
    runId: string;
    attempt: number;
    status: ChatRunStatus;
    terminalReason?: string | null;
    lastMessageId?: string | null;
  }): Promise<ChatRun | null> {
    const current = await this.getById(params.runId);

    if (
      !current ||
      current.attempt !== params.attempt ||
      isTerminalChatRunStatus(current.status) ||
      !canTransitionChatRun(current.status, params.status)
    ) {
      return null;
    }

    const now = new Date().toISOString();
    const completedAt = isTerminalChatRunStatus(params.status) ? now : null;
    const updateStatement = this.env.DB.prepare(
      `UPDATE conversation_run
       SET status = ?, updated_at = ?,
           started_at = CASE WHEN ? = 'running' THEN COALESCE(started_at, ?) ELSE started_at END,
           completed_at = CASE WHEN ? IS NOT NULL THEN ? ELSE completed_at END,
           terminal_reason = ?,
           last_message_id = COALESCE(?, last_message_id),
           retry_json = NULL,
           event_sequence = event_sequence + 1
       WHERE id = ? AND attempt = ? AND status = ?
       RETURNING *`,
    ).bind(
      params.status,
      now,
      params.status,
      now,
      completedAt,
      completedAt,
      params.terminalReason?.slice(0, 500) ?? null,
      params.lastMessageId ?? null,
      params.runId,
      params.attempt,
      current.status,
    );
    const event = {
      id: `event_${generateId()}`,
      runId: params.runId,
      type: "run.status_changed",
      occurredAt: now,
      data: {
        previousStatus: current.status,
        status: params.status,
        terminalReason: params.terminalReason?.slice(0, 500) ?? null,
        lastMessageId: params.lastMessageId ?? null,
      },
      expectedAttempt: params.attempt,
    };
    const [runResult] = await this.env.DB.batch([
      updateStatement,
      buildInsertRunEventStatement(this.env.DB, event, { ignoreSequenceConflict: true }),
      buildTrimRunEventsStatement(this.env.DB, params.runId),
    ]);
    const transitioned = runResult.results[0] as ConversationRunRow | undefined;

    if (!transitioned) {
      return null;
    }

    return formatRun(transitioned);
  }
}
