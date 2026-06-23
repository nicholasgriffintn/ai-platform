import { readNumberField, readNumberFieldAlias, readStringField } from "~/utils/recordFields";

import { deriveBlendedPrice } from "./pricing";
import { scoreHigherIsBetter, scoreLowerIsBetter } from "./scoreUtils";
import type {
	ArtificialAnalysisScoreResult,
	ArtificialAnalysisScores,
	ArtificialAnalysisScoringInput,
} from "./types";

function pushStrength(strengths: string[], value: string, enabled: boolean): void {
	if (enabled && !strengths.includes(value)) {
		strengths.push(value);
	}
}

function readArenaElo(evaluations: Record<string, unknown>): number | undefined {
	return readNumberFieldAlias(evaluations, [
		"arena_elo",
		"text_to_image_elo",
		"image_editing_elo",
		"music_with_vocals_elo",
		"text_to_speech_elo",
		"text_to_video_elo",
		"image_to_video_elo",
		"text_to_video_audio_elo",
		"image_to_video_audio_elo",
	]);
}

function isSpeechToTextModel(modelType: unknown): boolean {
	return modelType === "speech_to_text";
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
	const modelType = readStringField(evaluations, "artificial_analysis_model_type");
	const arenaElo = readArenaElo(evaluations);
	const bbaScore = readNumberField(evaluations, "bba_score");
	const fdbScore = readNumberField(evaluations, "fdb_score");
	const tauVoiceScore = readNumberField(evaluations, "tau_voice_score");
	const werIndex = readNumberField(evaluations, "aa_wer_index");

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
		arenaQuality: scoreHigherIsBetter(arenaElo, [1250, 1150, 1050, 950]),
		audioQuality: scoreHigherIsBetter(
			Math.max(bbaScore ?? 0, fdbScore ?? 0, tauVoiceScore ?? 0) || undefined,
			[0.8, 0.6, 0.4, 0.2],
		),
		transcriptionQuality: scoreLowerIsBetter(
			isSpeechToTextModel(modelType) ? werIndex : undefined,
			[0.02, 0.05, 0.1, 0.2],
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
	pushStrength(strengths, "image", modelType === "text_to_image" || modelType === "image_editing");
	pushStrength(strengths, "vision", modelType === "image_editing");
	pushStrength(
		strengths,
		"video",
		modelType === "text_to_video" ||
			modelType === "image_to_video" ||
			modelType === "text_to_video_audio" ||
			modelType === "image_to_video_audio",
	);
	pushStrength(
		strengths,
		"audio",
		modelType === "music_with_vocals" ||
			modelType === "text_to_speech" ||
			modelType === "speech_to_speech",
	);
	pushStrength(strengths, "transcription", modelType === "speech_to_text");
	pushStrength(strengths, "creative", (scores.arenaQuality ?? 0) >= 4);

	return { strengths, scores };
}
