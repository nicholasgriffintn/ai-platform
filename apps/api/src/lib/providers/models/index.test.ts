import { describe, expect, it } from "vitest";
import { getFeaturedModels } from ".";

describe("featured model catalogue", () => {
	it("contains only active models with descriptions", () => {
		const featuredModels = getFeaturedModels({ shouldUseCache: false });

		expect(Object.keys(featuredModels).length).toBeGreaterThan(0);

		for (const [modelId, model] of Object.entries(featuredModels)) {
			expect(model.deprecated, `${modelId} is deprecated`).not.toBe(true);
			expect(model.description?.trim(), `${modelId} is missing a description`).toBeTruthy();
		}
	});
});
