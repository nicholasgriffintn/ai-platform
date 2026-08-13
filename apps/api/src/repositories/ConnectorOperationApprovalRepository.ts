import type { ConnectorOperationApproval } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generatePrefixedId } from "~/utils/id";

import { BaseRepository } from "./BaseRepository";

export interface ConnectorOperationApprovalRecord {
	id: string;
	userId: number;
	runId: string;
	completionId: string;
	provider: string;
	operation: string;
	connectedAccountId: string;
	channel: string;
	argumentDigest: string;
	state: "pending" | "approved" | "rejected" | "consumed";
	createdAt: string;
	expiresAt: string;
	resolvedAt: string | null;
	consumedAt: string | null;
}

function parseApproval(record: ConnectorOperationApproval): ConnectorOperationApprovalRecord {
	return {
		id: record.id,
		userId: record.user_id,
		runId: record.run_id,
		completionId: record.completion_id,
		provider: record.provider,
		operation: record.operation,
		connectedAccountId: record.connected_account_id,
		channel: record.channel,
		argumentDigest: record.argument_digest,
		state: record.state,
		createdAt: record.created_at,
		expiresAt: record.expires_at,
		resolvedAt: record.resolved_at,
		consumedAt: record.consumed_at,
	};
}

export class ConnectorOperationApprovalRepository extends BaseRepository {
	async getByIdsForUser(
		ids: readonly string[],
		userId: number,
	): Promise<ConnectorOperationApprovalRecord[]> {
		const uniqueIds = [...new Set(ids)];
		if (uniqueIds.length === 0) return [];

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

	async create(input: {
		userId: number;
		runId: string;
		completionId: string;
		provider: string;
		operation: string;
		connectedAccountId: string;
		channel: string;
		argumentDigest: string;
		createdAt?: string;
		expiresAt: string;
	}): Promise<ConnectorOperationApprovalRecord> {
		const insert = this.buildInsertQuery(
			"connector_operation_approval",
			{
				id: generatePrefixedId("coa_"),
				user_id: input.userId,
				run_id: input.runId,
				completion_id: input.completionId,
				provider: input.provider,
				operation: input.operation,
				connected_account_id: input.connectedAccountId,
				channel: input.channel,
				argument_digest: input.argumentDigest,
				state: "pending",
				created_at: input.createdAt ?? new Date().toISOString(),
				expires_at: input.expiresAt,
			},
			{ returning: "*" },
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
		consumedAt: string;
	}): Promise<ConnectorOperationApprovalRecord | null> {
		const result = await this.runQuery<ConnectorOperationApproval>(
			`UPDATE connector_operation_approval
			 SET state = 'consumed', consumed_at = ?
			 WHERE id = ? AND user_id = ? AND state = 'approved' AND expires_at > ?
			   AND run_id = ? AND completion_id = ? AND provider = ? AND operation = ?
			   AND connected_account_id = ? AND channel = ? AND argument_digest = ?
			 RETURNING *`,
			[
				input.consumedAt,
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
			],
			true,
		);
		return result ? parseApproval(result) : null;
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
