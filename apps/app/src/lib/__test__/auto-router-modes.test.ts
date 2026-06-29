import { describe, expect, it } from "vitest";

import type { ModelConfigItem } from "@assistant/schemas";
import {
	countAutoRouterModeCandidates,
	doesModelMatchAutoRouterMode,
	getAutoRouterModeCandidates,
} from "../auto-router-modes";

const makeModel = (id: string, overrides: Partial<ModelConfigItem> = {}): ModelConfigItem => ({
	id,
	name: id,
	matchingModel: id,
	provider: "test",
	modalities: { input: ["text"], output: ["text"] },
	includedInRouter: true,
	...overrides,
});

describe("auto router modes", () => {
	it("keeps auto as the full active router pool", () => {
		expect(doesModelMatchAutoRouterMode(makeModel("active"), "auto")).toBe(true);
		expect(
			doesModelMatchAutoRouterMode(makeModel("manual", { includedInRouter: false }), "auto"),
		).toBe(false);
		expect(doesModelMatchAutoRouterMode(makeModel("legacy", { deprecated: true }), "auto")).toBe(
			false,
		);
	});

	it("matches lite to fast low-cost models", () => {
		expect(
			doesModelMatchAutoRouterMode(
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
			doesModelMatchAutoRouterMode(
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

		expect(doesModelMatchAutoRouterMode(proModel, "pro")).toBe(true);
		expect(doesModelMatchAutoRouterMode(proModel, "max")).toBe(false);
		expect(doesModelMatchAutoRouterMode(maxModel, "max")).toBe(true);
	});

	it("counts candidates for a mode", () => {
		expect(
			countAutoRouterModeCandidates(
				[
					makeModel("lite-1", { speed: 5, contextComplexity: 3 }),
					makeModel("lite-2", { speed: 4, contextComplexity: 4 }),
					makeModel("slow", { speed: 2, contextComplexity: 3 }),
				],
				"lite",
			),
		).toBe(2);
	});

	it("returns candidate examples for a mode", () => {
		expect(
			getAutoRouterModeCandidates(
				[
					makeModel("lite-1", { speed: 5, contextComplexity: 3 }),
					makeModel("slow", { speed: 2, contextComplexity: 3 }),
				],
				"lite",
			).map((model) => model.id),
		).toEqual(["lite-1"]);
	});
});
