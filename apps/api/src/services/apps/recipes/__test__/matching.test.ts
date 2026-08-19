import type { AssistantRecipe, RecipeInstallation } from "@ngriffin_uk/polychat-schemas";
import { describe, expect, it } from "vitest";

import { matchInstalledRecipe } from "../matching";

function createRecipe(overrides: Partial<AssistantRecipe> = {}): AssistantRecipe {
  return {
    id: "morning-briefing",
    title: "Morning Briefing",
    summary: "A daily digest",
    description: "Summarises calendar, weather, and unread mail every morning",
    kind: "automation",
    category: "productivity",
    featured: false,
    integrations: [],
    triggers: [],
    actions: [],
    setupPrompt: "",
    enabledTools: [],
    configurationFields: [],
    ...overrides,
  } as AssistantRecipe;
}

function createInstallation(recipeId: string): RecipeInstallation {
  return { recipeId, status: "active" } as RecipeInstallation;
}

describe("matchInstalledRecipe", () => {
  it("matches a recipe the query actually names", () => {
    const recipe = createRecipe();
    const match = matchInstalledRecipe({
      query: "run my morning briefing",
      recipes: [recipe],
      installations: [createInstallation(recipe.id)],
    });

    expect(match.status).toBe("matched");
    expect(match.recipe?.id).toBe("morning-briefing");
  });

  it("does not run a recipe on incidental word overlap alone", () => {
    const recipe = createRecipe();
    const match = matchInstalledRecipe({
      query: "what is the weather doing before my calendar fills up with mail",
      recipes: [recipe],
      installations: [createInstallation(recipe.id)],
    });

    expect(match.status).toBe("not_found");
  });

  it("does not run the only installed recipe for a query with no usable tokens", () => {
    const recipe = createRecipe();
    const match = matchInstalledRecipe({
      query: "?",
      recipes: [recipe],
      installations: [createInstallation(recipe.id)],
    });

    expect(match.status).toBe("not_found");
  });

  it("still runs the only installed recipe for an explicit generic trigger", () => {
    const recipe = createRecipe();
    const match = matchInstalledRecipe({
      query: "run my automation",
      recipes: [recipe],
      installations: [createInstallation(recipe.id)],
    });

    expect(match.status).toBe("matched");
  });

  it("asks which recipe when a generic trigger has several candidates", () => {
    const first = createRecipe();
    const second = createRecipe({ id: "evening-wrap", title: "Evening Wrap" });
    const match = matchInstalledRecipe({
      query: "run my automation",
      recipes: [first, second],
      installations: [createInstallation(first.id), createInstallation(second.id)],
    });

    expect(match.status).toBe("ambiguous");
    expect(match.candidates).toHaveLength(2);
  });
});
