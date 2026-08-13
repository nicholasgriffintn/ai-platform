import type { ComposioConnectorSession } from "~/lib/database/schema";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generatePrefixedId } from "~/utils/id";
import { safeParseJson } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

export interface ComposioConnectorSessionRecord {
	id: string;
	remoteSessionId: string;
	kind: "tool" | "connection";
	userId: number;
	provider: string;
	toolkitSlug: string;
	authConfigId: string | null;
	connectedAccountId: string | null;
	allowedOperationIds: readonly string[];
	runId: string;
	completionId: string | null;
	recipeId: string | null;
	installationId: string | null;
	state: "active" | "claimed" | "cleanup_pending";
	createdAt: string;
	expiresAt: string;
	claimedAt: string | null;
	cleanupAttempts: number;
	cleanupAfter: string | null;
}

function parseAllowedOperationIds(
	value: ComposioConnectorSession["allowed_operation_ids"],
): string[] {
	const parsed = typeof value === "string" ? safeParseJson<unknown>(value) : value;
	return Array.isArray(parsed)
		? parsed.filter((item): item is string => typeof item === "string")
		: [];
}

function parseSession(record: ComposioConnectorSession): ComposioConnectorSessionRecord {
	return {
		id: record.id,
		remoteSessionId: record.remote_session_id,
		kind: record.kind,
		userId: record.user_id,
		provider: record.provider,
		toolkitSlug: record.toolkit_slug,
		authConfigId: record.auth_config_id,
		connectedAccountId: record.connected_account_id,
		allowedOperationIds: parseAllowedOperationIds(record.allowed_operation_ids),
		runId: record.run_id,
		completionId: record.completion_id,
		recipeId: record.recipe_id,
		installationId: record.installation_id,
		state: record.state,
		createdAt: record.created_at,
		expiresAt: record.expires_at,
		claimedAt: record.claimed_at,
		cleanupAttempts: record.cleanup_attempts,
		cleanupAfter: record.cleanup_after,
	};
}

export class ComposioConnectorSessionRepository extends BaseRepository {
	async create(input: {
		remoteSessionId: string;
		kind: "tool" | "connection";
		userId: number;
		provider: string;
		toolkitSlug: string;
		authConfigId?: string | null;
		connectedAccountId?: string | null;
		allowedOperationIds: readonly string[];
		runId: string;
		completionId?: string | null;
		recipeId?: string | null;
		installationId?: string | null;
		createdAt?: string;
		expiresAt: string;
	}): Promise<ComposioConnectorSessionRecord> {
		const insert = this.buildInsertQuery(
			"composio_connector_session",
			{
				id: generatePrefixedId("ccs_"),
				remote_session_id: input.remoteSessionId,
				kind: input.kind,
				user_id: input.userId,
				provider: input.provider,
				toolkit_slug: input.toolkitSlug,
				auth_config_id: input.authConfigId ?? null,
				connected_account_id: input.connectedAccountId ?? null,
				allowed_operation_ids: input.allowedOperationIds,
				run_id: input.runId,
				completion_id: input.completionId ?? null,
				recipe_id: input.recipeId ?? null,
				installation_id: input.installationId ?? null,
				state: "active",
				created_at: input.createdAt ?? new Date().toISOString(),
				expires_at: input.expiresAt,
				cleanup_attempts: 0,
			},
			{ jsonFields: ["allowed_operation_ids"], returning: "*" },
		);
		if (!insert) {
			throw new AssistantError("Failed to build Composio session", ErrorType.INTERNAL_ERROR);
		}
		const result = await this.runQuery<ComposioConnectorSession>(insert.query, insert.values, true);
		if (!result) {
			throw new AssistantError("Failed to create Composio session", ErrorType.DATABASE_ERROR);
		}
		return parseSession(result);
	}

	async claimForExecution(input: {
		id: string;
		userId: number;
		provider: string;
		operationId: string;
		runId: string;
		completionId: string;
		recipeId?: string | null;
		installationId?: string | null;
		claimedAt: string;
	}): Promise<ComposioConnectorSessionRecord | null> {
		const result = await this.runQuery<ComposioConnectorSession>(
			`UPDATE composio_connector_session
			 SET state = 'claimed', claimed_at = COALESCE(claimed_at, ?)
			 WHERE id = ? AND user_id = ? AND provider = ? AND kind = 'tool'
			   AND state IN ('active', 'claimed') AND expires_at > ?
			   AND run_id = ? AND completion_id = ?
			   AND recipe_id IS ? AND installation_id IS ?
			   AND EXISTS (
				 SELECT 1 FROM json_each(allowed_operation_ids) WHERE value = ?
			   )
			 RETURNING *`,
			[
				input.claimedAt,
				input.id,
				input.userId,
				input.provider,
				input.claimedAt,
				input.runId,
				input.completionId,
				input.recipeId ?? null,
				input.installationId ?? null,
				input.operationId,
			],
			true,
		);
		return result ? parseSession(result) : null;
	}

	async markCleanupPending(input: { id: string; cleanupAfter: string }): Promise<void> {
		await this.executeRun(
			`UPDATE composio_connector_session
			 SET state = 'cleanup_pending', cleanup_attempts = cleanup_attempts + 1,
			     cleanup_after = ?
			 WHERE id = ?`,
			[input.cleanupAfter, input.id],
		);
	}

	async claimCleanup(input: {
		id: string;
		now: string;
		leaseUntil: string;
	}): Promise<ComposioConnectorSessionRecord | null> {
		const result = await this.runQuery<ComposioConnectorSession>(
			`UPDATE composio_connector_session
			 SET state = 'cleanup_pending', cleanup_after = ?
			 WHERE id = ?
			   AND (expires_at <= ? OR (state = 'cleanup_pending' AND cleanup_after <= ?))
			 RETURNING *`,
			[input.leaseUntil, input.id, input.now, input.now],
			true,
		);
		return result ? parseSession(result) : null;
	}

	async delete(id: string): Promise<void> {
		await this.executeRun("DELETE FROM composio_connector_session WHERE id = ?", [id]);
	}

	async getById(id: string): Promise<ComposioConnectorSessionRecord | null> {
		const result = await this.runQuery<ComposioConnectorSession>(
			"SELECT * FROM composio_connector_session WHERE id = ?",
			[id],
			true,
		);
		return result ? parseSession(result) : null;
	}

	async listCleanupDue(input: {
		now: string;
		limit: number;
	}): Promise<ComposioConnectorSessionRecord[]> {
		const limit = Math.max(1, Math.min(100, Math.floor(input.limit)));
		const results = await this.runQuery<ComposioConnectorSession>(
			`SELECT * FROM composio_connector_session
			 WHERE expires_at <= ?
			    OR (state = 'cleanup_pending' AND cleanup_after IS NOT NULL AND cleanup_after <= ?)
			 ORDER BY CASE
			   WHEN state = 'cleanup_pending' THEN COALESCE(cleanup_after, expires_at)
			   ELSE expires_at
			 END ASC
			 LIMIT ?`,
			[input.now, input.now, limit],
		);
		return results.map(parseSession);
	}
}
