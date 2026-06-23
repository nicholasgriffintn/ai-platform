import { describe, expect, it, vi } from "vitest";

import {
	buildArtificialAnalysisRecord,
	deriveArtificialAnalysisScores,
	fetchArtificialAnalysisModels,
} from "../artificialAnalysis";

describe("artificial analysis model data", () => {
	it("normalises benchmark and pricing fields from the API payload", () => {
		const record = buildArtificialAnalysisRecord(
			{
				id: "aa-model-1",
				name: "Example Pro",
				slug: "example-pro",
				model_creator: {
					id: "creator-1",
					name: "Example AI",
					slug: "example-ai",
				},
				evaluations: {
					artificial_analysis_intelligence_index: 72.4,
					artificial_analysis_coding_index: 64.2,
					artificial_analysis_agentic_index: 70.1,
				},
				pricing: {
					price_1m_input_tokens: 0.3,
					price_1m_output_tokens: 2.7,
				},
				performance: {
					median_output_tokens_per_second: 146.2,
					median_time_to_first_token_seconds: 0.82,
					median_time_to_first_answer_token_seconds: 7.4,
					median_end_to_end_response_time_seconds: 10.82,
				},
			},
			"2026-06-23T10:00:00.000Z",
			{ intelligenceIndexVersion: 4.1 },
		);

		expect(record).toMatchObject({
			id: "aa-model-1",
			name: "Example Pro",
			slug: "example-pro",
			creator_id: "creator-1",
			creator_name: "Example AI",
			creator_slug: "example-ai",
			intelligence_index: 72.4,
			coding_index: 64.2,
			agentic_index: 70.1,
			price_1m_blended_3_to_1: 0.9,
			price_1m_input_tokens: 0.3,
			price_1m_output_tokens: 2.7,
			median_output_tokens_per_second: 146.2,
			median_time_to_first_token_seconds: 0.82,
			median_time_to_first_answer_token_seconds: 7.4,
			median_end_to_end_response_time_seconds: 10.82,
			intelligence_index_version: 4.1,
			source: "artificial_analysis",
			source_url: "https://artificialanalysis.ai/",
			ingested_at: "2026-06-23T10:00:00.000Z",
		});
		expect(record.evaluations).toEqual({
			artificial_analysis_intelligence_index: 72.4,
			artificial_analysis_coding_index: 64.2,
			artificial_analysis_agentic_index: 70.1,
		});
	});

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
		expect(result.scores).toEqual({
			intelligence: 4,
			coding: 4,
			agentic: 4,
			price: 4,
			outputSpeed: 4,
			firstTokenLatency: 4,
		});
	});

	it("fetches every page from the Free language models endpoint", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce({
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
			})
			.mockResolvedValueOnce({
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
			});

		const models = await fetchArtificialAnalysisModels("aa-key", fetchImpl);

		expect(models.map((model) => model.id)).toEqual(["model-1", "model-2"]);
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
	});
});
