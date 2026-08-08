import { describe, expect, it } from "vitest";

import { recipeInstallationUpdateRequestSchema } from "./apps";

describe("recipe installation update schema", () => {
	it("does not turn an omitted configuration into an empty update", () => {
		expect(recipeInstallationUpdateRequestSchema.parse({ status: "paused" })).toEqual({
			status: "paused",
		});
	});
});
