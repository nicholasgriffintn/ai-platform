import { describe, expect, it } from "vitest";

import { validateCapabilityReference } from "~/lib/capabilities";
import { assistantRecipes } from "~/services/apps/recipes/catalog";

describe("project capability references", () => {
  it("accepts catalogue apps and recipes", async () => {
    await expect(
      validateCapabilityReference("app", "featured-article-processor"),
    ).resolves.toBeUndefined();
    await expect(
      validateCapabilityReference("recipe", assistantRecipes[0].id),
    ).resolves.toBeUndefined();
  });

  it("rejects references outside the published catalogues", async () => {
    await expect(validateCapabilityReference("app", "unknown-app")).rejects.toMatchObject({
      message: "Unknown experience",
      statusCode: 404,
    });
    await expect(validateCapabilityReference("recipe", "unknown-recipe")).rejects.toMatchObject({
      message: "Unknown recipe",
      statusCode: 404,
    });
  });

  it("leaves tool validation to the configuration boundary", async () => {
    await expect(validateCapabilityReference("tool", "web_fetch")).resolves.toBeUndefined();
  });
});
