import type { ConnectorOperationApproval } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generatePrefixedId } from "~/utils/id";
import { parseJsonRecord } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

export interface ConnectorOperationApprovalRecord {
  id: string;
  userId: number;
  runId: string;
  runAttempt: number;
  completionId: string;
  provider: string;
  operation: string;
  connectedAccountId: string;
  channel: string;
  argumentDigest: string;
  arguments: Record<string, unknown>;
  authorityRevision: number;
  recipeId?: string;
  installationId?: string;
  projectId?: string;
  teammateContextId?: string;
  state: "pending" | "approved" | "rejected" | "consumed";
  createdAt: string;
  expiresAt: string;
  resolvedAt: string | null;
  consumedAt: string | null;
  executionState: "running" | "completed" | "indeterminate" | null;
  executionToken: string | null;
  executionLeaseExpiresAt: string | null;
  executionResult: Record<string, unknown> | null;
}

function parseApproval(record: ConnectorOperationApproval): ConnectorOperationApprovalRecord {
  return {
    id: record.id,
    userId: record.user_id,
    runId: record.run_id,
    runAttempt: record.run_attempt,
    completionId: record.completion_id,
    provider: record.provider,
    operation: record.operation,
    connectedAccountId: record.connected_account_id,
    channel: record.channel,
    argumentDigest: record.argument_digest,
    arguments: parseJsonRecord(record.arguments_json),
    authorityRevision: record.authority_revision,
    ...(record.recipe_id ? { recipeId: record.recipe_id } : {}),
    ...(record.installation_id ? { installationId: record.installation_id } : {}),
    ...(record.project_id ? { projectId: record.project_id } : {}),
    ...(record.teammate_context_id ? { teammateContextId: record.teammate_context_id } : {}),
    state: record.state,
    createdAt: record.created_at,
    expiresAt: record.expires_at,
    resolvedAt: record.resolved_at,
    consumedAt: record.consumed_at,
    executionState: record.execution_state,
    executionToken: record.execution_token,
    executionLeaseExpiresAt: record.execution_lease_expires_at,
    executionResult: record.execution_result_json
      ? parseJsonRecord(record.execution_result_json)
      : null,
  };
}

export class ConnectorOperationApprovalRepository extends BaseRepository {
  async listConsumedRunIds(runIds: readonly string[]): Promise<Set<string>> {
    const uniqueRunIds = [...new Set(runIds)];

    if (uniqueRunIds.length === 0) {
      return new Set();
    }

    const placeholders = uniqueRunIds.map(() => "?").join(", ");
    const rows = await this.runQuery<Pick<ConnectorOperationApproval, "run_id">>(
      `SELECT DISTINCT run_id FROM connector_operation_approval
       WHERE state = 'consumed' AND run_id IN (${placeholders})`,
      uniqueRunIds,
    );

    return new Set(rows.map((row) => row.run_id));
  }

  async getByIdsForUser(
    ids: readonly string[],
    userId: number,
  ): Promise<ConnectorOperationApprovalRecord[]> {
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) {
      return [];
    }

    const placeholders = uniqueIds.map(() => "?").join(", ");
    const results = await this.runQuery<ConnectorOperationApproval>(
      `SELECT * FROM connector_operation_approval
			 WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...uniqueIds],
    );

    return results.map(parseApproval);
  }

  async getByIdForUser(
    id: string,
    userId: number,
  ): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      "SELECT * FROM connector_operation_approval WHERE id = ? AND user_id = ?",
      [id, userId],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async getResumableByIdForUser(
    id: string,
    userId: number,
  ): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      `SELECT approval.*
       FROM connector_operation_approval approval
       INNER JOIN conversation_run run
         ON run.id = approval.run_id
        AND run.attempt = approval.run_attempt
        AND run.conversation_id = approval.completion_id
        AND run.initiator_user_id = approval.user_id
       WHERE approval.id = ?
         AND approval.user_id = ?
         AND run.status = 'awaiting_approval'
         AND run.interaction_kind = 'approval'`,
      [id, userId],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async create(input: {
    userId: number;
    runId: string;
    runAttempt: number;
    completionId: string;
    provider: string;
    operation: string;
    connectedAccountId: string;
    channel: string;
    argumentDigest: string;
    arguments: Record<string, unknown>;
    authorityRevision: number;
    recipeId?: string;
    installationId?: string;
    projectId?: string;
    teammateContextId?: string;
    createdAt?: string;
    expiresAt: string;
  }): Promise<ConnectorOperationApprovalRecord> {
    const insert = this.buildInsertQuery(
      "connector_operation_approval",
      {
        id: generatePrefixedId("coa_"),
        user_id: input.userId,
        run_id: input.runId,
        run_attempt: input.runAttempt,
        completion_id: input.completionId,
        provider: input.provider,
        operation: input.operation,
        connected_account_id: input.connectedAccountId,
        channel: input.channel,
        argument_digest: input.argumentDigest,
        arguments_json: input.arguments,
        authority_revision: input.authorityRevision,
        recipe_id: input.recipeId ?? null,
        installation_id: input.installationId ?? null,
        project_id: input.projectId ?? null,
        teammate_context_id: input.teammateContextId ?? null,
        state: "pending",
        created_at: input.createdAt ?? new Date().toISOString(),
        expires_at: input.expiresAt,
      },
      { returning: "*", jsonFields: ["arguments_json"] },
    );

    if (!insert) {
      throw new AssistantError("Failed to build connector approval", ErrorType.INTERNAL_ERROR);
    }

    const result = await this.runQuery<ConnectorOperationApproval>(
      insert.query,
      insert.values,
      true,
    );

    if (!result) {
      throw new AssistantError("Failed to create connector approval", ErrorType.DATABASE_ERROR);
    }

    return parseApproval(result);
  }

  async resolve(input: {
    id: string;
    userId: number;
    resolution: "approved" | "rejected";
    resolvedAt: string;
  }): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      `UPDATE connector_operation_approval
			 SET state = ?, resolved_at = ?
			 WHERE id = ? AND user_id = ? AND state = 'pending' AND expires_at > ?
         AND EXISTS (
           SELECT 1 FROM conversation_run run
           WHERE run.id = connector_operation_approval.run_id
             AND run.attempt = connector_operation_approval.run_attempt
             AND run.conversation_id = connector_operation_approval.completion_id
             AND run.initiator_user_id = connector_operation_approval.user_id
             AND run.status = 'awaiting_approval'
             AND run.interaction_kind = 'approval'
         )
			 RETURNING *`,
      [input.resolution, input.resolvedAt, input.id, input.userId, input.resolvedAt],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async consume(input: {
    id: string;
    userId: number;
    runId: string;
    completionId: string;
    provider: string;
    operation: string;
    connectedAccountId: string;
    channel: string;
    argumentDigest: string;
    authorityRevision: number;
    recipeId?: string;
    installationId?: string;
    projectId?: string;
    teammateContextId?: string;
    consumedAt: string;
    executionToken: string;
    executionLeaseExpiresAt: string;
  }): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      `UPDATE connector_operation_approval
       SET state = 'consumed', consumed_at = ?, execution_state = 'running',
           execution_token = ?, execution_lease_expires_at = ?, execution_result_json = NULL
			 WHERE id = ? AND user_id = ? AND state = 'approved' AND expires_at > ?
			   AND run_id = ? AND completion_id = ? AND provider = ? AND operation = ?
			   AND connected_account_id = ? AND channel = ? AND argument_digest = ?
			   AND authority_revision = ?
			   AND recipe_id IS ? AND installation_id IS ? AND project_id IS ?
			   AND teammate_context_id IS ?
			   AND EXISTS (
           SELECT 1 FROM conversation_run run
           WHERE run.id = connector_operation_approval.run_id
             AND run.attempt = connector_operation_approval.run_attempt
             AND run.conversation_id = connector_operation_approval.completion_id
             AND run.initiator_user_id = connector_operation_approval.user_id
             AND run.status = 'awaiting_approval'
             AND run.interaction_kind = 'approval'
         )
			 RETURNING *`,
      [
        input.consumedAt,
        input.executionToken,
        input.executionLeaseExpiresAt,
        input.id,
        input.userId,
        input.consumedAt,
        input.runId,
        input.completionId,
        input.provider,
        input.operation,
        input.connectedAccountId,
        input.channel,
        input.argumentDigest,
        input.authorityRevision,
        input.recipeId ?? null,
        input.installationId ?? null,
        input.projectId ?? null,
        input.teammateContextId ?? null,
      ],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async recordExecutionResult(input: {
    id: string;
    userId: number;
    executionToken: string;
    result: Record<string, unknown>;
  }): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      `UPDATE connector_operation_approval
       SET execution_state = 'completed', execution_result_json = ?,
           execution_lease_expires_at = NULL
       WHERE id = ? AND user_id = ? AND state = 'consumed'
         AND execution_state = 'running' AND execution_token = ?
       RETURNING *`,
      [JSON.stringify(input.result), input.id, input.userId, input.executionToken],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async recordIndeterminateExecution(input: {
    id: string;
    userId: number;
    observedAt: string;
    result: Record<string, unknown>;
  }): Promise<ConnectorOperationApprovalRecord | null> {
    const result = await this.runQuery<ConnectorOperationApproval>(
      `UPDATE connector_operation_approval
       SET execution_state = 'indeterminate', execution_result_json = ?,
           execution_lease_expires_at = NULL
       WHERE id = ? AND user_id = ? AND state = 'consumed'
         AND execution_result_json IS NULL
         AND (execution_state IS NULL OR execution_state = 'indeterminate'
           OR (execution_state = 'running' AND execution_lease_expires_at <= ?))
       RETURNING *`,
      [JSON.stringify(input.result), input.id, input.userId, input.observedAt],
      true,
    );

    return result ? parseApproval(result) : null;
  }

  async deleteUnconsumedForRun(runId: string, runAttempt: number): Promise<void> {
    await this.executeRun(
      `DELETE FROM connector_operation_approval
       WHERE run_id = ? AND run_attempt = ? AND state IN ('pending', 'approved')`,
      [runId, runAttempt],
    );
  }

  async deleteExpired(input: { pendingBefore: string; resolvedBefore: string }): Promise<number> {
    const result = await this.executeRun(
      `DELETE FROM connector_operation_approval
			 WHERE (state = 'pending' AND expires_at <= ?)
			    OR (state != 'pending' AND expires_at <= ?)`,
      [input.pendingBefore, input.resolvedBefore],
    );

    return result.meta?.changes ?? 0;
  }
}
