import { describe, expect, it } from "vitest";

import { artificialAnalysisModelsResponseSchema } from "./models";

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
			}),
		).not.toThrow();
	});
});
