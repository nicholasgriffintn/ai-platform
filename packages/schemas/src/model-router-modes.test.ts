import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "./models";
import {
	doesModelMatchRouterMode,
	filterModelsByRouterMode,
	isActiveRouterModel,
	sortModelsByRouterModeFit,
} from "./model-router-modes";

const makeModel = (id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem => ({
	id,
	name: id,
	matchingModel: id,
	provider: "test",
	modalities: { input: ["text"], output: ["text"] },
	contextComplexity: 3,
	reliability: 4,
	speed: 3,
	...overrides,
});

describe("model router modes", () => {
	it("keeps auto as the unfiltered router pool", () => {
		expect(doesModelMatchRouterMode(makeModel("active"), "auto")).toBe(true);
	});

	it("identifies active router models for display counts", () => {
		expect(isActiveRouterModel(makeModel("active"))).toBe(true);
		expect(isActiveRouterModel(makeModel("free", { isFree: true }))).toBe(true);
		expect(isActiveRouterModel(makeModel("legacy", { deprecated: true }))).toBe(false);
		expect(isActiveRouterModel(makeModel("preview", { status: "alpha" }))).toBe(false);
		expect(
			isActiveRouterModel(makeModel("openrouter/free", { provider: "openrouter", isFree: true })),
		).toBe(false);
		expect(
			isActiveRouterModel(
				makeModel("openrouter/free-suffix", {
					provider: "openrouter",
					matchingModel: "deepseek/deepseek-r1:free",
				}),
			),
		).toBe(false);
		expect(isActiveRouterModel(makeModel("missing-speed", { speed: undefined }))).toBe(false);
		expect(isActiveRouterModel(makeModel("missing-reliability", { reliability: undefined }))).toBe(
			false,
		);
		expect(
			isActiveRouterModel(makeModel("missing-complexity", { contextComplexity: undefined })),
		).toBe(false);
	});

	it("matches lite to fast low-cost models", () => {
		expect(
			doesModelMatchRouterMode(
				makeModel("lite", {
					speed: 5,
					contextComplexity: 3,
					costPer1kInputTokens: 0.0001,
					costPer1kOutputTokens: 0.0002,
				}),
				"lite",
			),
		).toBe(true);
		expect(
			doesModelMatchRouterMode(
				makeModel("expensive", {
					speed: 5,
					contextComplexity: 3,
					costPer1kInputTokens: 0.05,
					costPer1kOutputTokens: 0.1,
				}),
				"lite",
			),
		).toBe(false);
	});

	it("matches pro and max to stronger model characteristics", () => {
		const proModel = makeModel("pro", {
			contextComplexity: 4,
			speed: 3,
			artificialAnalysis: { intelligenceIndex: 35 },
			strengths: ["reasoning", "tool_use"],
		});
		const maxModel = makeModel("max", {
			contextComplexity: 5,
			reliability: 5,
			artificialAnalysis: { intelligenceIndex: 45 },
			strengths: ["reasoning"],
		});

		expect(doesModelMatchRouterMode(proModel, "pro")).toBe(true);
		expect(doesModelMatchRouterMode(proModel, "max")).toBe(false);
		expect(doesModelMatchRouterMode(maxModel, "max")).toBe(true);
	});

	it("does not promote reliable mid-grade models into max", () => {
		expect(
			doesModelMatchRouterMode(
				makeModel("reliable-mid", {
					contextComplexity: 3,
					reliability: 5,
					speed: 4,
					strengths: ["chat"],
					artificialAnalysis: { intelligenceIndex: 12 },
				}),
				"max",
			),
		).toBe(false);
	});

	it("does not promote low-benchmark advanced-strength models into pro", () => {
		expect(
			doesModelMatchRouterMode(
				makeModel("weak-reasoning", {
					contextComplexity: 4,
					reliability: 5,
					speed: 4,
					strengths: ["reasoning"],
					artificialAnalysis: { intelligenceIndex: 7 },
				}),
				"pro",
			),
		).toBe(false);
	});

	it("does not promote flash-grade models into pro", () => {
		expect(
			doesModelMatchRouterMode(
				makeModel("deepseek-v4-flash", {
					contextComplexity: 5,
					reliability: 1,
					speed: 4,
					strengths: ["reasoning", "coding", "analysis", "multilingual", "tool_use"],
					artificialAnalysis: { intelligenceIndex: 28.7 },
				}),
				"pro",
			),
		).toBe(false);
	});

	it("filters model maps by router mode", () => {
		expect(
			Object.keys(
				filterModelsByRouterMode(
					{
						"lite-1": makeModel("lite-1", { speed: 5, contextComplexity: 3 }),
						"lite-2": makeModel("lite-2", { speed: 4, contextComplexity: 4 }),
						slow: makeModel("slow", { speed: 2, contextComplexity: 3 }),
					},
					"lite",
				),
			),
		).toEqual(["lite-1", "lite-2"]);
	});

	it("sorts models by router-mode fit instead of catalogue order", () => {
		expect(
			sortModelsByRouterModeFit(
				[
					makeModel("mid", {
						name: "Mid",
						contextComplexity: 4,
						reliability: 3,
						speed: 3,
						strengths: ["reasoning"],
						artificialAnalysis: { intelligenceIndex: 35 },
					}),
					makeModel("strong", {
						name: "Strong",
						contextComplexity: 5,
						reliability: 5,
						speed: 3,
						strengths: ["reasoning", "analysis"],
						artificialAnalysis: { intelligenceIndex: 45 },
					}),
				],
				"pro",
			).map((model) => model.id),
		).toEqual(["strong", "mid"]);
	});
});
