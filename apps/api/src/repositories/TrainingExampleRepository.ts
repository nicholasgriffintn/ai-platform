import { BaseRepository } from "./BaseRepository";
import type { IEnv } from "~/types";
import { generateId } from "~/utils/id";

export interface CreateTrainingExampleData {
	userId?: number;
	conversationId?: string;
	source: "chat" | "app";
	appName?: string;
	userPrompt: string;
	assistantResponse: string;
	systemPrompt?: string;
	modelUsed?: string;
	feedbackRating?: number;
	feedbackComment?: string;
	metadata?: Record<string, any>;
	qualityScore?: number;
	includeInTraining?: boolean;
	taskCategory?: string;
	difficultyLevel?: "easy" | "medium" | "hard" | "expert";
	languageCode?: string;
	userPromptTokens?: number;
	assistantResponseTokens?: number;
	responseTimeMs?: number;
	conversationTurn?: number;
	conversationContext?: {
		previousMessages?: Array<{
			role: "user" | "assistant";
			content: string;
			timestamp?: string;
		}>;
		totalTurns?: number;
		conversationStartTime?: string;
	};
	userSatisfactionSignals?: {
		timeOnPage?: number;
		scrollBehavior?: string;
		copyToClipboard?: boolean;
		followUpQuestions?: number;
		sessionDuration?: number;
	};
}

export interface TrainingExampleFilters {
	userId?: number;
	conversationId?: string;
	source?: "chat" | "app";
	appName?: string;
	exported?: boolean;
	minFeedbackRating?: number;
	minQualityScore?: number;
	includeInTraining?: boolean;
	since?: Date;
	limit?: number;
	offset?: number;
	taskCategory?: string;
	difficultyLevel?: "easy" | "medium" | "hard" | "expert";
	languageCode?: string;
	minConversationTurn?: number;
	maxConversationTurn?: number;
	minResponseTime?: number;
	maxResponseTime?: number;
	minTokens?: number;
	maxTokens?: number;
}

export class TrainingExampleRepository extends BaseRepository {
	constructor(env: IEnv) {
		super(env);
	}

	async create(data: CreateTrainingExampleData): Promise<Record<string, any>> {
		const id = generateId();

		const result = await this.runQuery<Record<string, any>>(
			`INSERT INTO training_examples (
        id, user_id, conversation_id, source, app_name,
        user_prompt, assistant_response, system_prompt, model_used,
        feedback_rating, feedback_comment, metadata, quality_score,
        include_in_training, exported, task_category, difficulty_level,
        language_code, user_prompt_tokens, assistant_response_tokens,
        response_time_ms, conversation_turn, conversation_context,
        user_satisfaction_signals, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      RETURNING *`,
			[
				id,
				data.userId || null,
				data.conversationId || null,
				data.source,
				data.appName || null,
				data.userPrompt,
				data.assistantResponse,
				data.systemPrompt || null,
				data.modelUsed || null,
				data.feedbackRating || null,
				data.feedbackComment || null,
				data.metadata ? JSON.stringify(data.metadata) : null,
				data.qualityScore || null,
				data.includeInTraining !== undefined
					? data.includeInTraining
						? 1
						: 0
					: 1,
				data.taskCategory || null,
				data.difficultyLevel || null,
				data.languageCode || "en",
				data.userPromptTokens || null,
				data.assistantResponseTokens || null,
				data.responseTimeMs || null,
				data.conversationTurn || 1,
				data.conversationContext
					? JSON.stringify(data.conversationContext)
					: null,
				data.userSatisfactionSignals
					? JSON.stringify(data.userSatisfactionSignals)
					: null,
			],
			true,
		);

		return result || {};
	}

	async findById(id: string): Promise<Record<string, any> | null> {
		return await this.runQuery<Record<string, any>>(
			"SELECT * FROM training_examples WHERE id = ?",
			[id],
			true,
		);
	}

	async findMany(
		filters: TrainingExampleFilters = {},
	): Promise<Record<string, any>[]> {
		const conditions: string[] = [];
		const params: any[] = [];

		if (filters.userId !== undefined) {
			conditions.push("user_id = ?");
			params.push(filters.userId);
		}

		if (filters.conversationId) {
			conditions.push("conversation_id = ?");
			params.push(filters.conversationId);
		}

		if (filters.source) {
			conditions.push("source = ?");
			params.push(filters.source);
		}

		if (filters.appName) {
			conditions.push("app_name = ?");
			params.push(filters.appName);
		}

		if (filters.exported !== undefined) {
			conditions.push("exported = ?");
			params.push(filters.exported ? 1 : 0);
		}

		if (filters.includeInTraining !== undefined) {
			conditions.push("include_in_training = ?");
			params.push(filters.includeInTraining ? 1 : 0);
		}

		if (filters.minFeedbackRating !== undefined) {
			conditions.push("feedback_rating >= ?");
			params.push(filters.minFeedbackRating);
		}

		if (filters.minQualityScore !== undefined) {
			conditions.push("quality_score >= ?");
			params.push(filters.minQualityScore);
		}

		if (filters.since) {
			conditions.push("created_at >= ?");
			params.push(filters.since.toISOString());
		}

		let query = "SELECT * FROM training_examples";

		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		query += " ORDER BY created_at DESC";

		if (filters.limit) {
			query += " LIMIT ?";
			params.push(filters.limit);
		}

		if (filters.offset) {
			query += " OFFSET ?";
			params.push(filters.offset);
		}

		return await this.runQuery<Record<string, any>>(query, params, false);
	}

	async markAsExported(ids: string[]): Promise<number> {
		if (ids.length === 0) {
			return 0;
		}

		const placeholders = ids.map(() => "?").join(",");
		const result = await this.executeRun(
			`UPDATE training_examples
       SET exported = 1, exported_at = datetime('now')
       WHERE id IN (${placeholders})`,
			ids,
		);

		return result.meta.changes;
	}

	async updateIncludeInTraining(
		id: string,
		includeInTraining: boolean,
	): Promise<boolean> {
		const result = await this.executeRun(
			`UPDATE training_examples
       SET include_in_training = ?
       WHERE id = ?`,
			[includeInTraining ? 1 : 0, id],
		);

		return result.meta.changes > 0;
	}

	async updateQualityScore(id: string, qualityScore: number): Promise<boolean> {
		const result = await this.executeRun(
			`UPDATE training_examples
       SET quality_score = ?
       WHERE id = ?`,
			[qualityScore, id],
		);

		return result.meta.changes > 0;
	}

	async updateById(
		id: string,
		updates: Partial<{
			feedback_rating: number;
			feedback_comment: string;
			quality_score: number;
			include_in_training: boolean;
		}>,
	): Promise<boolean> {
		const setClauses: string[] = [];
		const params: any[] = [];

		if (updates.feedback_rating !== undefined) {
			setClauses.push("feedback_rating = ?");
			params.push(updates.feedback_rating);
		}

		if (updates.feedback_comment !== undefined) {
			setClauses.push("feedback_comment = ?");
			params.push(updates.feedback_comment);
		}

		if (updates.quality_score !== undefined) {
			setClauses.push("quality_score = ?");
			params.push(updates.quality_score);
		}

		if (updates.include_in_training !== undefined) {
			setClauses.push("include_in_training = ?");
			params.push(updates.include_in_training ? 1 : 0);
		}

		if (setClauses.length === 0) {
			return false;
		}

		params.push(id);
		const result = await this.executeRun(
			`UPDATE training_examples
       SET ${setClauses.join(", ")}
       WHERE id = ?`,
			params,
		);

		return result.meta.changes > 0;
	}

	async countByFilters(filters: TrainingExampleFilters = {}): Promise<number> {
		const conditions: string[] = [];
		const params: any[] = [];

		if (filters.userId !== undefined) {
			conditions.push("user_id = ?");
			params.push(filters.userId);
		}

		if (filters.conversationId) {
			conditions.push("conversation_id = ?");
			params.push(filters.conversationId);
		}

		if (filters.source) {
			conditions.push("source = ?");
			params.push(filters.source);
		}

		if (filters.appName) {
			conditions.push("app_name = ?");
			params.push(filters.appName);
		}

		if (filters.exported !== undefined) {
			conditions.push("exported = ?");
			params.push(filters.exported ? 1 : 0);
		}

		if (filters.includeInTraining !== undefined) {
			conditions.push("include_in_training = ?");
			params.push(filters.includeInTraining ? 1 : 0);
		}

		if (filters.minFeedbackRating !== undefined) {
			conditions.push("feedback_rating >= ?");
			params.push(filters.minFeedbackRating);
		}

		if (filters.minQualityScore !== undefined) {
			conditions.push("quality_score >= ?");
			params.push(filters.minQualityScore);
		}

		if (filters.since) {
			conditions.push("created_at >= ?");
			params.push(filters.since.toISOString());
		}

		let query = "SELECT COUNT(*) as count FROM training_examples";

		if (conditions.length > 0) {
			query += ` WHERE ${conditions.join(" AND ")}`;
		}

		const result = await this.runQuery<{ count: number }>(query, params, true);
		return result?.count || 0;
	}

	async deleteById(id: string): Promise<boolean> {
		const result = await this.executeRun(
			"DELETE FROM training_examples WHERE id = ?",
			[id],
		);

		return result.meta.changes > 0;
	}
}
