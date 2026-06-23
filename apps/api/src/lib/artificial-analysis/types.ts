export type ArtificialAnalysisScores = {
	intelligence?: number;
	coding?: number;
	agentic?: number;
	price?: number;
	outputSpeed?: number;
	firstTokenLatency?: number;
	arenaQuality?: number;
	audioQuality?: number;
	transcriptionQuality?: number;
};

export type ArtificialAnalysisScoreResult = {
	strengths: string[];
	scores: ArtificialAnalysisScores;
};

export type ArtificialAnalysisModelRecord = {
	id: string;
	name: string;
	slug?: string;
	creator_id?: string;
	creator_name?: string;
	creator_slug?: string;
	evaluations: Record<string, unknown>;
	pricing: Record<string, unknown>;
	intelligence_index?: number;
	coding_index?: number;
	agentic_index?: number;
	intelligence_index_version?: number;
	price_1m_blended_3_to_1?: number;
	price_1m_input_tokens?: number;
	price_1m_output_tokens?: number;
	median_output_tokens_per_second?: number;
	median_time_to_first_token_seconds?: number;
	median_time_to_first_answer_token_seconds?: number;
	median_end_to_end_response_time_seconds?: number;
	derived_strengths?: string[];
	derived_scores?: ArtificialAnalysisScores;
	source: "artificial_analysis";
	source_url: "https://artificialanalysis.ai/";
	ingested_at: string;
	created_at?: string;
	updated_at?: string;
};

export type ArtificialAnalysisScoringInput = {
	evaluations?: Record<string, unknown> | null;
	pricing?: Record<string, unknown> | null;
	median_output_tokens_per_second?: number | null;
	median_time_to_first_token_seconds?: number | null;
};
