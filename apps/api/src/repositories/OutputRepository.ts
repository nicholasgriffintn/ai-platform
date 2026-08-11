import type { OutputSensitivity, OutputStatus } from "@assistant/schemas";

import { KVCache } from "~/lib/cache";
import type { IEnv } from "~/types";
import { AssistantError, ErrorType } from "~/utils/errors";
import { generateId } from "~/utils/id";
import { BaseRepository } from "./BaseRepository";

export interface OutputRecord {
	id: string;
	created_by_user_id: number;
	project_id: string | null;
	conversation_id: string | null;
	parent_output_id: string | null;
	capability_id: string;
	group_id: string | null;
	kind: string;
	title: string;
	status: OutputStatus;
	sensitivity: OutputSensitivity;
	content: string;
	storage_key: string | null;
	mime_type: string | null;
	filename: string | null;
	byte_size: number | null;
	revision: number;
	created_at: string;
	updated_at: string | null;
}

export interface CreateOutputRecord {
	id?: string;
	createdByUserId: number;
	projectId?: string | null;
	conversationId?: string | null;
	parentOutputId?: string | null;
	capabilityId: string;
	groupId?: string | null;
	kind: string;
	title: string;
	status?: OutputStatus;
	sensitivity?: OutputSensitivity;
	content?: unknown;
	storageKey?: string | null;
	mimeType?: string | null;
	filename?: string | null;
	byteSize?: number | null;
}

export interface UpdateOutputRecord {
	title?: string;
	status?: OutputStatus;
	sensitivity?: OutputSensitivity;
	content?: unknown;
	expectedRevision: number;
	updatedByUserId: number;
}

export interface OutputShareRecord {
	id: string;
	output_id: string;
	token_hash: string;
	permission: "view";
	created_by_user_id: number;
	expires_at: string | null;
	revoked_at: string | null;
	created_at: string;
}

export interface OutputRevisionRecord {
	output_id: string;
	revision: number;
	title: string;
	status: OutputStatus;
	sensitivity: OutputSensitivity;
	content: string;
	created_by_user_id: number;
	created_at: string;
}

const OUTPUT_CACHE_TTL = 900;

export class OutputRepository extends BaseRepository {
	private cache: KVCache | null = null;

	constructor(env: IEnv) {
		super(env);
		if (env.CACHE) this.cache = new KVCache(env.CACHE, OUTPUT_CACHE_TTL);
	}

	async createOutput(input: CreateOutputRecord): Promise<OutputRecord> {
		const id = input.id ?? generateId();
		const insert = this.buildInsertQuery(
			"output",
			{
				id,
				created_by_user_id: input.createdByUserId,
				project_id: input.projectId ?? null,
				conversation_id: input.conversationId ?? null,
				parent_output_id: input.parentOutputId ?? null,
				capability_id: input.capabilityId,
				group_id: input.groupId ?? null,
				kind: input.kind,
				title: input.title,
				status: input.status ?? "ready",
				sensitivity: input.sensitivity ?? (input.projectId ? "internal" : "personal"),
				content: input.content ?? {},
				storage_key: input.storageKey ?? null,
				mime_type: input.mimeType ?? null,
				filename: input.filename ?? null,
				byte_size: input.byteSize ?? null,
			},
			{ jsonFields: ["content"], returning: "*" },
		);
		if (!insert) {
			throw new AssistantError("Failed to build output insert query", ErrorType.INTERNAL_ERROR);
		}

		const output = await this.runQuery<OutputRecord>(insert.query, insert.values, true);
		if (!output) throw new AssistantError("Failed to create output", ErrorType.DATABASE_ERROR);
		return output;
	}

	async getOutput(outputId: string): Promise<OutputRecord | null> {
		const cacheKey = KVCache.createKey("output", outputId);
		if (this.cache) {
			return this.cache.cacheQuery(cacheKey, () => this.selectOne({ id: outputId }), {
				ttl: OUTPUT_CACHE_TTL,
			});
		}
		return this.selectOne({ id: outputId });
	}

	async getPersonalOutput(userId: number, outputId: string): Promise<OutputRecord | null> {
		return this.selectOne({ id: outputId, created_by_user_id: userId, project_id: null });
	}

	async getProjectOutput(projectId: string, outputId: string): Promise<OutputRecord | null> {
		return this.selectOne({ id: outputId, project_id: projectId });
	}

	async getOutputByGroupId(groupId: string): Promise<OutputRecord | null> {
		return this.selectOne({ group_id: groupId });
	}

	async getPersonalOutputByGroup(
		userId: number,
		groupId: string,
		kind?: string,
	): Promise<OutputRecord | null> {
		return this.selectOne({
			created_by_user_id: userId,
			project_id: null,
			group_id: groupId,
			kind,
		});
	}

	async getOutputByCapabilityAndGroup(
		capabilityId: string,
		groupId: string,
	): Promise<OutputRecord | null> {
		return this.selectOne({ capability_id: capabilityId, group_id: groupId });
	}

	async listPersonalOutputs(userId: number, capabilityId?: string): Promise<OutputRecord[]> {
		return this.selectMany({
			created_by_user_id: userId,
			project_id: null,
			capability_id: capabilityId,
		});
	}

	async listProjectOutputs(projectId: string, capabilityId?: string): Promise<OutputRecord[]> {
		return this.selectMany({ project_id: projectId, capability_id: capabilityId });
	}

	async listPersonalOutputGroup(
		userId: number,
		capabilityId: string,
		groupId: string,
		kind?: string,
	): Promise<OutputRecord[]> {
		return this.selectMany({
			created_by_user_id: userId,
			project_id: null,
			capability_id: capabilityId,
			group_id: groupId,
			kind,
		});
	}

	async listProjectOutputGroup(
		projectId: string,
		capabilityId: string,
		groupId: string,
		kind?: string,
	): Promise<OutputRecord[]> {
		return this.selectMany({
			project_id: projectId,
			capability_id: capabilityId,
			group_id: groupId,
			kind,
		});
	}

	async updateOutput(outputId: string, input: UpdateOutputRecord): Promise<OutputRecord> {
		const existing = await this.getOutput(outputId);
		if (!existing) throw new AssistantError("Output not found", ErrorType.NOT_FOUND, 404);
		if (existing.revision !== input.expectedRevision) {
			throw new AssistantError("Output has changed", ErrorType.CONFLICT_ERROR, 409);
		}

		const nextRevision = existing.revision + 1;
		const update = this.buildUpdateQuery(
			"output",
			{
				title: input.title,
				status: input.status,
				sensitivity: input.sensitivity,
				content: input.content,
				revision: nextRevision,
			},
			["title", "status", "sensitivity", "content", "revision"],
			"id = ? AND revision = ?",
			[outputId, input.expectedRevision],
			{ jsonFields: ["content"] },
		);
		if (!update || !this.env.DB) {
			throw new AssistantError("Failed to build output update query", ErrorType.INTERNAL_ERROR);
		}

		const revisionInsert = this.env.DB.prepare(
			`INSERT INTO output_revision
			 (output_id, revision, title, status, sensitivity, content, created_by_user_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		).bind(
			outputId,
			existing.revision,
			existing.title,
			existing.status,
			existing.sensitivity,
			existing.content,
			input.updatedByUserId,
		);
		const updateStatement = this.env.DB.prepare(update.query).bind(...update.values);
		const results = await this.env.DB.batch([revisionInsert, updateStatement]);
		if (!results.every((result) => result.success)) {
			throw new AssistantError("Failed to update output", ErrorType.DATABASE_ERROR);
		}

		await this.cache?.delete(KVCache.createKey("output", outputId));
		const updated = await this.getOutput(outputId);
		if (!updated || updated.revision !== nextRevision) {
			throw new AssistantError("Output update conflicted", ErrorType.CONFLICT_ERROR, 409);
		}
		return updated;
	}

	async deleteOutput(outputId: string): Promise<void> {
		const { query, values } = this.buildDeleteQuery("output", { id: outputId });
		await this.executeRun(query, values);
		await this.cache?.delete(KVCache.createKey("output", outputId));
	}

	async deletePersonalOutputGroup(
		userId: number,
		capabilityId: string,
		groupId: string,
		kind?: string,
	): Promise<void> {
		const { query, values } = this.buildDeleteQuery("output", {
			created_by_user_id: userId,
			project_id: null,
			capability_id: capabilityId,
			group_id: groupId,
			kind,
		});
		await this.executeRun(query, values);
	}

	async deleteProjectOutputGroup(
		projectId: string,
		capabilityId: string,
		groupId: string,
		kind?: string,
	): Promise<void> {
		const { query, values } = this.buildDeleteQuery("output", {
			project_id: projectId,
			capability_id: capabilityId,
			group_id: groupId,
			kind,
		});
		await this.executeRun(query, values);
	}

	async attachSources(outputId: string, sourceIds: string[]): Promise<void> {
		if (!this.env.DB || sourceIds.length === 0) return;
		await this.env.DB.batch(
			sourceIds.map((sourceId) =>
				this.env
					.DB!.prepare("INSERT OR IGNORE INTO output_source (output_id, source_id) VALUES (?, ?)")
					.bind(outputId, sourceId),
			),
		);
	}

	async createShare(input: {
		id: string;
		outputId: string;
		tokenHash: string;
		createdByUserId: number;
		expiresAt?: string | null;
	}): Promise<OutputShareRecord> {
		const insert = this.buildInsertQuery(
			"output_share",
			{
				id: input.id,
				output_id: input.outputId,
				token_hash: input.tokenHash,
				permission: "view",
				created_by_user_id: input.createdByUserId,
				expires_at: input.expiresAt ?? null,
			},
			{ returning: "*" },
		);
		if (!insert) throw new AssistantError("Failed to create share", ErrorType.INTERNAL_ERROR);
		const share = await this.runQuery<OutputShareRecord>(insert.query, insert.values, true);
		if (!share) throw new AssistantError("Failed to create share", ErrorType.DATABASE_ERROR);
		return share;
	}

	async getShareByTokenHash(tokenHash: string): Promise<OutputShareRecord | null> {
		const { query, values } = this.buildSelectQuery("output_share", { token_hash: tokenHash });
		return this.runQuery<OutputShareRecord>(query, values, true);
	}

	async listShares(outputId: string): Promise<OutputShareRecord[]> {
		const { query, values } = this.buildSelectQuery(
			"output_share",
			{ output_id: outputId },
			{ orderBy: "created_at DESC" },
		);
		return this.runQuery<OutputShareRecord>(query, values);
	}

	async revokeShare(outputId: string, shareId: string): Promise<void> {
		await this.executeRun(
			"UPDATE output_share SET revoked_at = ? WHERE id = ? AND output_id = ? AND revoked_at IS NULL",
			[new Date().toISOString(), shareId, outputId],
		);
	}

	async listRevisions(outputId: string): Promise<OutputRevisionRecord[]> {
		const { query, values } = this.buildSelectQuery(
			"output_revision",
			{ output_id: outputId },
			{ orderBy: "revision DESC" },
		);
		return this.runQuery<OutputRevisionRecord>(query, values);
	}

	private async selectOne(conditions: Record<string, unknown>): Promise<OutputRecord | null> {
		const { query, values } = this.buildSelectQuery("output", conditions);
		return this.runQuery<OutputRecord>(query, values, true);
	}

	private async selectMany(conditions: Record<string, unknown>): Promise<OutputRecord[]> {
		const { query, values } = this.buildSelectQuery("output", conditions, {
			orderBy: "updated_at DESC, created_at DESC",
		});
		return this.runQuery<OutputRecord>(query, values);
	}
}
