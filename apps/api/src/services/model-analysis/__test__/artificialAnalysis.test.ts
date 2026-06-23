import { describe, expect, it, vi } from "vitest";

import { ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS } from "~/lib/artificial-analysis/endpoints";
import { deriveArtificialAnalysisScores } from "~/lib/artificial-analysis/scoring";

import { fetchArtificialAnalysisModels } from "../artificialAnalysis";

describe("artificial analysis model data", () => {
	it("derives strengths and bounded scores from evaluations, price, speed, and latency", () => {
		const result = deriveArtificialAnalysisScores({
			evaluations: {
				artificial_analysis_intelligence_index: 78,
				artificial_analysis_coding_index: 67,
				artificial_analysis_agentic_index: 73,
			},
			pricing: {
				price_1m_input_tokens: 0.25,
				price_1m_output_tokens: 2.05,
			},
			median_output_tokens_per_second: 121,
			median_time_to_first_token_seconds: 0.74,
		});

		expect(result.strengths).toEqual([
			"general_knowledge",
			"analysis",
			"reasoning",
			"coding",
			"agents",
			"low_cost",
			"fast_output",
			"low_latency",
		]);
		expect(result.scores).toEqual(
			expect.objectContaining({
				intelligence: 4,
				coding: 4,
				agentic: 4,
				price: 4,
				outputSpeed: 4,
				firstTokenLatency: 4,
			}),
		);
	});

	it("derives media strengths and bounded scores from arena and speech fields", () => {
		const result = deriveArtificialAnalysisScores({
			evaluations: {
				artificial_analysis_model_type: "speech_to_text",
				aa_wer_index: 0.04,
				arena_elo: 1220,
				bba_score: 0.65,
			},
		});

		expect(result.strengths).toEqual(expect.arrayContaining(["transcription", "creative"]));
		expect(result.scores).toEqual(
			expect.objectContaining({
				arenaQuality: 4,
				audioQuality: 4,
				transcriptionQuality: 4,
			}),
		);
	});

	it("fetches every page from language models and every free media endpoint", async () => {
		const fetchImpl = vi.fn(async (input: string | URL | Request) => {
			const url = new URL(String(input));
			if (url.pathname === "/api/v2/language/models/free" && url.searchParams.get("page") === "1") {
				return {
					ok: true,
					json: async () => ({
						tier: "free",
						intelligence_index_version: 4.1,
						pagination: {
							page: 1,
							page_size: 1,
							total_pages: 2,
							has_more: true,
						},
						data: [
							{
								id: "model-1",
								name: "Model 1",
								evaluations: {},
								pricing: {},
								performance: {},
							},
						],
					}),
				} as Response;
			}
			if (url.pathname === "/api/v2/language/models/free" && url.searchParams.get("page") === "2") {
				return {
					ok: true,
					json: async () => ({
						tier: "free",
						intelligence_index_version: 4.1,
						pagination: {
							page: 2,
							page_size: 1,
							total_pages: 2,
							has_more: false,
						},
						data: [
							{
								id: "model-2",
								name: "Model 2",
								evaluations: {},
								pricing: {},
								performance: {},
							},
						],
					}),
				} as Response;
			}

			return {
				ok: true,
				json: async () => ({
					tier: "free",
					data: [
						{
							id: url.pathname.split("/").at(-3) ?? "media-model",
							name: `Media ${url.pathname}`,
							elo: 1120,
							ci_95: 12,
							model_creator: {
								id: "creator",
								name: "Creator",
							},
						},
					],
				}),
			} as Response;
		});

		const models = await fetchArtificialAnalysisModels("aa-key", fetchImpl);

		expect(models).toHaveLength(ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS.length + 1);
		expect(models.map((model) => model.id)).toEqual(
			expect.arrayContaining(["model-1", "model-2", "text_to_image:text-to-image"]),
		);
		expect(models.find((model) => model.id === "text_to_image:text-to-image")?.evaluations).toEqual(
			expect.objectContaining({
				artificial_analysis_model_type: "text_to_image",
				arena_elo: 1120,
			}),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			1,
			"https://artificialanalysis.ai/api/v2/language/models/free?page=1",
			expect.any(Object),
		);
		expect(fetchImpl).toHaveBeenNthCalledWith(
			2,
			"https://artificialanalysis.ai/api/v2/language/models/free?page=2",
			expect.any(Object),
		);
		for (const endpoint of ARTIFICIAL_ANALYSIS_FREE_MODEL_ENDPOINTS.filter(
			(candidate) => !candidate.paginated,
		)) {
			expect(fetchImpl).toHaveBeenCalledWith(
				`https://artificialanalysis.ai${endpoint.path}`,
				expect.any(Object),
			);
		}
	});
});
