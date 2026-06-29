import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "./models";
import {
	doesModelMatchRouterMode,
	filterModelsByRouterMode,
	isActiveRouterModel,
} from "./model-router-modes";

const makeModel = (id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem => ({
	id,
	name: id,
	matchingModel: id,
	provider: "test",
	modalities: { input: ["text"], output: ["text"] },
	includedInRouter: true,
	...overrides,
});

describe("model router modes", () => {
	it("keeps auto as the unfiltered router pool", () => {
		expect(doesModelMatchRouterMode(makeModel("active"), "auto")).toBe(true);
	});

	it("identifies active router models for display counts", () => {
		expect(isActiveRouterModel(makeModel("active"))).toBe(true);
		expect(isActiveRouterModel(makeModel("manual", { includedInRouter: false }))).toBe(false);
		expect(isActiveRouterModel(makeModel("legacy", { deprecated: true }))).toBe(false);
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
			strengths: ["reasoning", "tool_use"],
		});
		const maxModel = makeModel("max", {
			contextComplexity: 5,
			reliability: 5,
			strengths: ["reasoning"],
		});

		expect(doesModelMatchRouterMode(proModel, "pro")).toBe(true);
		expect(doesModelMatchRouterMode(proModel, "max")).toBe(false);
		expect(doesModelMatchRouterMode(maxModel, "max")).toBe(true);
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
});
