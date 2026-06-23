import { isRecord } from "~/utils/objects";
import {
	readNumberField,
	readNumberFieldAlias,
	readRecordObjectField,
	readStringField,
} from "~/utils/recordFields";

import {
	ARTIFICIAL_ANALYSIS_ATTRIBUTION_URL,
	ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE,
	ARTIFICIAL_ANALYSIS_SOURCE,
} from "./constants";
import { ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS } from "./endpoints";
import type { ArtificialAnalysisEndpoint } from "./endpoints";
import { deriveBlendedPrice } from "./pricing";
import type { ArtificialAnalysisModelRecord } from "./types";

function buildArtificialAnalysisId(payload: Record<string, unknown>, modelType: string): string {
	const id = readStringField(payload, "id");
	if (!id) {
		throw new Error("Artificial Analysis model payload missing id or name");
	}
	return modelType === ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE ? id : `${modelType}:${id}`;
}

function buildMediaEvaluations(
	payload: Record<string, unknown>,
	endpoint: ArtificialAnalysisEndpoint,
): Record<string, unknown> {
	const evaluations: Record<string, unknown> = {
		artificial_analysis_model_type: endpoint.modelType,
		artificial_analysis_model_type_label: endpoint.label,
		artificial_analysis_source_id: readStringField(payload, "id"),
	};
	const arenaElo = readNumberField(payload, "elo");
	if (arenaElo !== undefined) {
		evaluations.arena_elo = arenaElo;
		evaluations[`${endpoint.modelType}_elo`] = arenaElo;
	}
	const ci95 = readNumberField(payload, "ci_95");
	if (ci95 !== undefined) {
		evaluations.arena_ci_95 = ci95;
		evaluations[`${endpoint.modelType}_ci_95`] = ci95;
	}

	for (const field of [
		"bba_score",
		"fdb_score",
		"tau_voice_score",
		"aa_wer_index",
		"aa_agenttalk",
		"voxpopuli_cleaned_aa",
		"earnings_22_cleaned_aa",
	]) {
		const value = readNumberField(payload, field);
		if (value !== undefined) {
			evaluations[field] = value;
		}
	}

	return evaluations;
}

export function buildArtificialAnalysisRecord(
	payload: unknown,
	ingestedAt = new Date().toISOString(),
	options: { intelligenceIndexVersion?: number; endpoint?: ArtificialAnalysisEndpoint } = {},
): ArtificialAnalysisModelRecord {
	if (!isRecord(payload)) {
		throw new Error("Artificial Analysis model payload must be an object");
	}

	const modelType = options.endpoint?.modelType ?? ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE;
	const id = buildArtificialAnalysisId(payload, modelType);
	const name = readStringField(payload, "name");
	if (!name) {
		throw new Error("Artificial Analysis model payload missing id or name");
	}

	const creator = readRecordObjectField(payload, "model_creator");
	const evaluations =
		modelType === ARTIFICIAL_ANALYSIS_LLM_MODEL_TYPE
			? readRecordObjectField(payload, "evaluations")
			: buildMediaEvaluations(
					payload,
					options.endpoint ?? ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS[0],
				);
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
	endpoint = ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS[0],
): ArtificialAnalysisModelRecord[] {
	if (!isRecord(payload) || !Array.isArray(payload.data)) {
		throw new Error("Artificial Analysis response missing data array");
	}

	const intelligenceIndexVersion = readNumberField(payload, "intelligence_index_version");
	return payload.data.map((entry) =>
		buildArtificialAnalysisRecord(entry, ingestedAt, { intelligenceIndexVersion, endpoint }),
	);
}
