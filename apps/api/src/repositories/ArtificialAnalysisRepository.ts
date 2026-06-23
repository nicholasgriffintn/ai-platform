import type {
	ArtificialAnalysisModelRecord,
	ArtificialAnalysisScoreResult,
} from "~/services/model-analysis/artificialAnalysis";
import { PaginationHelper } from "~/lib/database/PaginationHelper";
import { parseJsonRecord, parseJsonStringArray } from "~/utils/json";

import { BaseRepository } from "./BaseRepository";

type ArtificialAnalysisModelRow = Omit<
	ArtificialAnalysisModelRecord,
	"evaluations" | "pricing" | "derived_strengths" | "derived_scores"
> & {
	evaluations: string;
	pricing: string;
	derived_strengths?: string | null;
	derived_scores?: string | null;
};

function parseModelRow(row: ArtificialAnalysisModelRow): ArtificialAnalysisModelRecord {
	return {
		...row,
		evaluations: parseJsonRecord(row.evaluations),
		pricing: parseJsonRecord(row.pricing),
		derived_strengths: parseJsonStringArray(row.derived_strengths),
		derived_scores: parseJsonRecord(row.derived_scores),
	};
}

export class ArtificialAnalysisRepository extends BaseRepository {
	public async upsertMany(records: ArtificialAnalysisModelRecord[]): Promise<number> {
		let stored = 0;

		for (const record of records) {
			await this.executeRun(
				`INSERT INTO artificial_analysis_models (
					id, name, slug, creator_id, creator_name, creator_slug,
					evaluations, pricing, intelligence_index, coding_index, agentic_index,
					intelligence_index_version, price_1m_blended_3_to_1, price_1m_input_tokens,
					price_1m_output_tokens, median_output_tokens_per_second,
					median_time_to_first_token_seconds, median_time_to_first_answer_token_seconds,
					median_end_to_end_response_time_seconds, source, source_url, ingested_at,
					updated_at
				)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
				ON CONFLICT(id) DO UPDATE SET
					name = excluded.name,
					slug = excluded.slug,
					creator_id = excluded.creator_id,
					creator_name = excluded.creator_name,
					creator_slug = excluded.creator_slug,
					evaluations = excluded.evaluations,
					pricing = excluded.pricing,
					intelligence_index = excluded.intelligence_index,
					coding_index = excluded.coding_index,
					agentic_index = excluded.agentic_index,
					intelligence_index_version = excluded.intelligence_index_version,
					price_1m_blended_3_to_1 = excluded.price_1m_blended_3_to_1,
					price_1m_input_tokens = excluded.price_1m_input_tokens,
					price_1m_output_tokens = excluded.price_1m_output_tokens,
					median_output_tokens_per_second = excluded.median_output_tokens_per_second,
					median_time_to_first_token_seconds = excluded.median_time_to_first_token_seconds,
					median_time_to_first_answer_token_seconds =
						excluded.median_time_to_first_answer_token_seconds,
					median_end_to_end_response_time_seconds =
						excluded.median_end_to_end_response_time_seconds,
					derived_strengths = NULL,
					derived_scores = NULL,
					source = excluded.source,
					source_url = excluded.source_url,
					ingested_at = excluded.ingested_at,
					updated_at = datetime('now')`,
				[
					record.id,
					record.name,
					record.slug ?? null,
					record.creator_id ?? null,
					record.creator_name ?? null,
					record.creator_slug ?? null,
					JSON.stringify(record.evaluations),
					JSON.stringify(record.pricing),
					record.intelligence_index ?? null,
					record.coding_index ?? null,
					record.agentic_index ?? null,
					record.intelligence_index_version ?? null,
					record.price_1m_blended_3_to_1 ?? null,
					record.price_1m_input_tokens ?? null,
					record.price_1m_output_tokens ?? null,
					record.median_output_tokens_per_second ?? null,
					record.median_time_to_first_token_seconds ?? null,
					record.median_time_to_first_answer_token_seconds ?? null,
					record.median_end_to_end_response_time_seconds ?? null,
					record.source,
					record.source_url,
					record.ingested_at,
				],
			);
			stored += 1;
		}

		return stored;
	}

	public async listAll(): Promise<ArtificialAnalysisModelRecord[]> {
		const rows = await this.runQuery<ArtificialAnalysisModelRow>(
			`SELECT * FROM artificial_analysis_models ORDER BY name ASC`,
		);
		return rows.map(parseModelRow);
	}

	public async listPage({ page, limit }: { page: number; limit: number }): Promise<{
		models: ArtificialAnalysisModelRecord[];
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	}> {
		const { limit: safeLimit, offset } = PaginationHelper.calculate(page, limit);
		const count = await this.runQuery<{ total: number }>(
			`SELECT COUNT(*) as total FROM artificial_analysis_models`,
			[],
			true,
		);
		const total = Number(count?.total ?? 0);
		const rows = await this.runQuery<ArtificialAnalysisModelRow>(
			`SELECT * FROM artificial_analysis_models ORDER BY name ASC LIMIT ? OFFSET ?`,
			[safeLimit, offset],
		);

		return {
			models: rows.map(parseModelRow),
			total,
			page: Math.max(1, page),
			limit: safeLimit,
			totalPages: Math.ceil(total / safeLimit),
		};
	}

	public async updateDerivedScores(
		modelId: string,
		result: ArtificialAnalysisScoreResult,
	): Promise<void> {
		await this.executeRun(
			`UPDATE artificial_analysis_models
			 SET derived_strengths = ?, derived_scores = ?, updated_at = datetime('now')
			 WHERE id = ?`,
			[JSON.stringify(result.strengths), JSON.stringify(result.scores), modelId],
		);
	}
}
