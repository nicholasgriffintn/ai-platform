import { describe, expect, it } from "vitest";

import {
	artificialAnalysisModelsQuerySchema,
	artificialAnalysisModelsResponseSchema,
	modelConfigItemSchema,
} from "./models";

describe("model schemas", () => {
	it("accepts the public Artificial Analysis route response shape", () => {
		expect(() =>
			artificialAnalysisModelsResponseSchema.parse({
				attribution: {
					label: "Artificial Analysis",
					url: "https://artificialanalysis.ai/",
				},
				models: [
					{
						id: "model-1",
						name: "Model 1",
						evaluations: {
							artificial_analysis_intelligence_index: 72,
						},
						pricing: {
							price_1m_input_tokens: 0.2,
							price_1m_output_tokens: 2.6,
						},
						source: "artificial_analysis",
						source_url: "https://artificialanalysis.ai/",
						ingested_at: "2026-06-23T10:00:00.000Z",
					},
				],
				pagination: {
					total: 1,
					page: 1,
					limit: 25,
					totalPages: 1,
				},
			}),
		).not.toThrow();
	});

	it("normalises Artificial Analysis route pagination query parameters", () => {
		expect(
			artificialAnalysisModelsQuerySchema.parse({
				page: "2",
				limit: "50",
			}),
		).toEqual({
			page: 2,
			limit: 50,
		});
	});

	it("accepts Artificial Analysis summaries on model catalogue items", () => {
		expect(() =>
			modelConfigItemSchema.parse({
				id: "claude-sonnet-4-5",
				matchingModel: "anthropic/claude-sonnet-4.5",
				name: "Claude Sonnet 4.5",
				provider: "vercel",
				artificialAnalysis: {
					intelligenceIndex: 72,
					codingIndex: 64,
					agenticIndex: 69,
					intelligenceIndexVersion: 4.1,
				},
			}),
		).not.toThrow();
	});

	it("accepts models.dev lifecycle and availability metadata on model catalogue items", () => {
		expect(
			modelConfigItemSchema.parse({
				id: "openrouter/owl-alpha",
				matchingModel: "openrouter/owl-alpha",
				name: "Owl Alpha",
				provider: "openrouter",
				family: "alpha",
				status: "alpha",
				openWeights: false,
			}),
		).toMatchObject({
			family: "alpha",
			status: "alpha",
			openWeights: false,
		});
	});
});
