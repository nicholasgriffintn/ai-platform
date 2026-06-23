import { isRecord } from "~/utils/objects";
import {
	readNumberField,
	readNumberFieldAlias,
	readRecordObjectField,
	readStringField,
} from "~/utils/recordFields";

export const ARTIFICIAL_ANALYSIS_SOURCE = "artificial_analysis";
export const ARTIFICIAL_ANALYSIS_ATTRIBUTION_URL = "https://artificialanalysis.ai/";
export const ARTIFICIAL_ANALYSIS_LLM_MODELS_URL =
	"https://artificialanalysis.ai/api/v2/language/models/free";

export type ArtificialAnalysisScores = {
	intelligence?: number;
	coding?: number;
	agentic?: number;
	price?: number;
	outputSpeed?: number;
	firstTokenLatency?: number;
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
	source: typeof ARTIFICIAL_ANALYSIS_SOURCE;
	source_url: typeof ARTIFICIAL_ANALYSIS_ATTRIBUTION_URL;
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

function deriveBlendedPrice(pricing: Record<string, unknown>): number | undefined {
	const explicit = readNumberField(pricing, "price_1m_blended_3_to_1");
	if (explicit !== undefined) {
		return explicit;
	}

	const inputPrice = readNumberField(pricing, "price_1m_input_tokens");
	const outputPrice = readNumberField(pricing, "price_1m_output_tokens");
	if (inputPrice === undefined || outputPrice === undefined) {
		return undefined;
	}

	return Number.parseFloat(((inputPrice * 3 + outputPrice) / 4).toFixed(10));
}

function scoreHigherIsBetter(
	value: number | undefined,
	thresholds: readonly number[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value >= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}

function scoreLowerIsBetter(
	value: number | undefined,
	thresholds: readonly number[],
): number | undefined {
	if (value === undefined) {
		return undefined;
	}
	for (let index = 0; index < thresholds.length; index += 1) {
		if (value <= thresholds[index]) {
			return thresholds.length - index + 1;
		}
	}
	return value > 0 ? 1 : undefined;
}

function pushStrength(strengths: string[], value: string, enabled: boolean): void {
	if (enabled && !strengths.includes(value)) {
		strengths.push(value);
	}
}

export function deriveArtificialAnalysisScores(
	input: ArtificialAnalysisScoringInput,
): ArtificialAnalysisScoreResult {
	const evaluations = input.evaluations ?? {};
	const pricing = input.pricing ?? {};

	const intelligence = readNumberField(evaluations, "artificial_analysis_intelligence_index");
	const coding = readNumberField(evaluations, "artificial_analysis_coding_index");
	const agentic = readNumberField(evaluations, "artificial_analysis_agentic_index");
	const blendedPrice = deriveBlendedPrice(pricing);

	const scores: ArtificialAnalysisScores = {
		intelligence: scoreHigherIsBetter(intelligence, [80, 65, 50, 35]),
		coding: scoreHigherIsBetter(coding, [80, 60, 45, 30]),
		agentic: scoreHigherIsBetter(agentic, [80, 65, 50, 35]),
		price: scoreLowerIsBetter(blendedPrice, [0.25, 1, 5, 15]),
		outputSpeed: scoreHigherIsBetter(
			input.median_output_tokens_per_second ?? undefined,
			[180, 100, 50, 20],
		),
		firstTokenLatency: scoreLowerIsBetter(
			input.median_time_to_first_token_seconds ?? undefined,
			[0.5, 1, 3, 8],
		),
	};

	const strengths: string[] = [];
	pushStrength(strengths, "general_knowledge", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "analysis", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "reasoning", (scores.intelligence ?? 0) >= 4);
	pushStrength(strengths, "coding", (scores.coding ?? 0) >= 4);
	pushStrength(strengths, "agents", (scores.agentic ?? 0) >= 4);
	pushStrength(strengths, "low_cost", (scores.price ?? 0) >= 4);
	pushStrength(strengths, "fast_output", (scores.outputSpeed ?? 0) >= 4);
	pushStrength(strengths, "low_latency", (scores.firstTokenLatency ?? 0) >= 4);

	return { strengths, scores };
}

export function buildArtificialAnalysisRecord(
	payload: unknown,
	ingestedAt = new Date().toISOString(),
	options: { intelligenceIndexVersion?: number } = {},
): ArtificialAnalysisModelRecord {
	if (!isRecord(payload)) {
		throw new Error("Artificial Analysis model payload must be an object");
	}

	const id = readStringField(payload, "id");
	const name = readStringField(payload, "name");
	if (!id || !name) {
		throw new Error("Artificial Analysis model payload missing id or name");
	}

	const creator = readRecordObjectField(payload, "model_creator");
	const evaluations = readRecordObjectField(payload, "evaluations");
	const pricing = readRecordObjectField(payload, "pricing");
	const performance = readRecordObjectField(payload, "performance");

	return {
		id,
		name,
		slug: readStringField(payload, "slug"),
		creator_id: readStringField(creator, "id"),
		creator_name: readStringField(creator, "name"),
		creator_slug: readStringField(creator, "slug"),
		evaluations,
		pricing,
		intelligence_index: readNumberField(evaluations, "artificial_analysis_intelligence_index"),
		coding_index: readNumberField(evaluations, "artificial_analysis_coding_index"),
		agentic_index: readNumberField(evaluations, "artificial_analysis_agentic_index"),
		intelligence_index_version: options.intelligenceIndexVersion,
		price_1m_blended_3_to_1: deriveBlendedPrice(pricing),
		price_1m_input_tokens: readNumberField(pricing, "price_1m_input_tokens"),
		price_1m_output_tokens: readNumberField(pricing, "price_1m_output_tokens"),
		median_output_tokens_per_second: readNumberField(
			performance,
			"median_output_tokens_per_second",
		),
		median_time_to_first_token_seconds: readNumberField(
			performance,
			"median_time_to_first_token_seconds",
		),
		median_time_to_first_answer_token_seconds: readNumberFieldAlias(performance, [
			"median_time_to_first_answer_token_seconds",
			"median_time_to_first_answer_token",
		]),
		median_end_to_end_response_time_seconds: readNumberField(
			performance,
			"median_end_to_end_response_time_seconds",
		),
		source: ARTIFICIAL_ANALYSIS_SOURCE,
		source_url: ARTIFICIAL_ANALYSIS_ATTRIBUTION_URL,
		ingested_at: ingestedAt,
	};
}

export function parseArtificialAnalysisModelsResponse(
	payload: unknown,
	ingestedAt = new Date().toISOString(),
): ArtificialAnalysisModelRecord[] {
	if (!isRecord(payload) || !Array.isArray(payload.data)) {
		throw new Error("Artificial Analysis response missing data array");
	}

	const intelligenceIndexVersion = readNumberField(payload, "intelligence_index_version");
	return payload.data.map((entry) =>
		buildArtificialAnalysisRecord(entry, ingestedAt, { intelligenceIndexVersion }),
	);
}

export async function fetchArtificialAnalysisModels(
	apiKey: string,
	fetchImpl: typeof fetch = fetch,
): Promise<ArtificialAnalysisModelRecord[]> {
	const models: ArtificialAnalysisModelRecord[] = [];
	let page = 1;
	let hasMore = true;

	while (hasMore) {
		const url = new URL(ARTIFICIAL_ANALYSIS_LLM_MODELS_URL);
		url.searchParams.set("page", String(page));
		const response = await fetchImpl(url.toString(), {
			headers: {
				accept: "application/json",
				"x-api-key": apiKey,
			},
		});

		if (!response.ok) {
			throw new Error(`Artificial Analysis API request failed: ${response.status}`);
		}

		const payload = await response.json();
		models.push(...parseArtificialAnalysisModelsResponse(payload));
		const pagination = readRecordObjectField(payload, "pagination");
		hasMore = pagination.has_more === true;
		page += 1;
	}

	return models;
}
