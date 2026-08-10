import { describe, expect, it } from "vitest";

import { assistantRecipes } from "~/services/apps/recipes/catalog";
import { validateProjectCapabilityReference } from "../capabilities";

describe("project capability references", () => {
	it("accepts catalogue apps and recipes", async () => {
		await expect(
			validateProjectCapabilityReference("app", "featured-article-processor"),
		).resolves.toBeUndefined();
		await expect(
			validateProjectCapabilityReference("recipe", assistantRecipes[0].id),
		).resolves.toBeUndefined();
	});

	it("rejects references outside the published catalogues", async () => {
		await expect(validateProjectCapabilityReference("app", "unknown-app")).rejects.toMatchObject({
			message: "Unknown project app",
			statusCode: 404,
		});
		await expect(
			validateProjectCapabilityReference("recipe", "unknown-recipe"),
		).rejects.toMatchObject({
			message: "Unknown project recipe",
			statusCode: 404,
		});
	});

	it("leaves tool validation to the configuration boundary", async () => {
		await expect(validateProjectCapabilityReference("tool", "web_fetch")).resolves.toBeUndefined();
	});
});
