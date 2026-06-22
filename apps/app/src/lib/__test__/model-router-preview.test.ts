import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import { buildAutomaticRouterPreview } from "../model-router-preview";

const makeModel = (
	id: string,
	provider: string,
	overrides: Partial<ModelConfigItem> = {},
): ModelConfigItem => ({
	id,
	matchingModel: id,
	name: id,
	provider,
	modalities: { input: ["text"], output: ["text"] },
	includedInRouter: true,
	isFree: true,
	...overrides,
});

describe("buildAutomaticRouterPreview", () => {
	it("uses only active router candidates", () => {
		const preview = buildAutomaticRouterPreview([
			makeModel("fast-model", "fast-provider", { strengths: ["chat"], speed: 5 }),
			makeModel("hidden-model", "hidden-provider", {
				includedInRouter: false,
				strengths: ["chat"],
			}),
			makeModel("deprecated-model", "legacy-provider", {
				deprecated: true,
				strengths: ["chat"],
			}),
		]);

		expect(preview.candidateCount).toBe(1);
		expect(preview.providerCount).toBe(1);
		expect(preview.lanes.flatMap((lane) => lane.models.map((model) => model.id))).toEqual([
			"fast-model",
		]);
	});

	it("groups candidates into usage lanes with the strongest matches first", () => {
		const preview = buildAutomaticRouterPreview([
			makeModel("quick", "workers-ai", {
				name: "Quick",
				strengths: ["chat", "summarization"],
				speed: 5,
				reliability: 4,
			}),
			makeModel("reasoner", "openai", {
				name: "Reasoner",
				strengths: ["reasoning", "analysis", "math"],
				contextComplexity: 5,
				reliability: 5,
			}),
			makeModel("coder", "anthropic", {
				name: "Coder",
				strengths: ["coding", "agents"],
				contextComplexity: 5,
				supportsToolCalls: true,
			}),
			makeModel("vision", "google-ai-studio", {
				name: "Vision",
				modalities: { input: ["text", "image", "pdf"], output: ["text"] },
				supportsDocuments: true,
			}),
		]);

		expect(preview.candidateCount).toBe(4);
		expect(preview.providerCount).toBe(4);
		expect(preview.lanes.find((lane) => lane.id === "fast")?.models[0].name).toBe("Quick");
		expect(preview.lanes.find((lane) => lane.id === "reasoning")?.models[0].name).toBe("Reasoner");
		expect(preview.lanes.find((lane) => lane.id === "code")?.models[0].name).toBe("Coder");
		expect(preview.lanes.find((lane) => lane.id === "vision-files")?.models[0].name).toBe("Vision");
	});

	it("counts matching lane models hidden behind the compact preview limit", () => {
		const preview = buildAutomaticRouterPreview([
			makeModel("quick-1", "workers-ai", { strengths: ["chat"], speed: 5 }),
			makeModel("quick-2", "openai", { strengths: ["chat"], speed: 5 }),
			makeModel("quick-3", "anthropic", { strengths: ["chat"], speed: 5 }),
			makeModel("quick-4", "mistral", { strengths: ["chat"], speed: 5 }),
			makeModel("quick-5", "xai", { strengths: ["chat"], speed: 5 }),
		]);

		const fastLane = preview.lanes.find((lane) => lane.id === "fast");

		expect(fastLane?.models).toHaveLength(3);
		expect(fastLane?.moreModelCount).toBe(2);
	});
});
