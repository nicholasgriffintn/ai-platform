import type { AssistantRecipe } from "@ngriffin_uk/polychat-schemas";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useProjectCapabilityCatalog } from "./useProjectCapabilityCatalog";

const mocks = vi.hoisted(() => ({
  appsData: vi.fn(),
  catalogueScope: vi.fn(),
  recipes: vi.fn(),
  tools: vi.fn(),
}));

const recipe = {
  id: "daily-briefing",
  title: "Daily Briefing",
  summary: "Summarise the day",
  description: "Build a daily summary",
  kind: "automate",
  category: "Productivity",
  featured: true,
  integrations: [],
  triggers: [],
  actions: ["Summarise"],
  setupPrompt: "Set up a daily briefing",
  enabledTools: [],
  configurationFields: [],
} satisfies AssistantRecipe;

vi.mock("./useCapabilityCatalog", () => ({
  useCapabilityCatalog: (projectId?: string) => {
    mocks.catalogueScope(projectId);

    return {
      data: mocks.appsData(),
      error: null,
      isLoading: false,
    };
  },
}));
vi.mock("./useRecipes", () => ({
  useAssistantRecipes: () => ({
    data: {
      categories: ["Productivity"],
      filters: ["automate"],
      recipes: mocks.recipes(),
    },
    error: null,
    isLoading: false,
  }),
}));
vi.mock("./useTools", () => ({
  useTools: () => ({
    data: mocks.tools(),
    error: null,
    isLoading: false,
  }),
}));

describe("useProjectCapabilityCatalog", () => {
  it("loads the catalogue for the current project scope", () => {
    mocks.appsData.mockReturnValue({ experiences: [], modelTools: [], skills: [] });
    mocks.recipes.mockReturnValue([]);
    mocks.tools.mockReturnValue([]);

    renderHook(() => useProjectCapabilityCatalog("project-1"));

    expect(mocks.catalogueScope).toHaveBeenLastCalledWith("project-1");
  });

  it("uses API metadata and includes every recipe rather than only installations", () => {
    mocks.appsData.mockReturnValue({
      experiences: [
        {
          id: "notes",
          runtime: "notes",
          name: "Notes",
          description: "Write notes",
          category: "Productivity",
          requirement: {
            kind: "capability",
            capabilityKind: "app",
            capabilityId: "notes-app",
          },
        },
      ],
      modelTools: [
        {
          id: "web_fetch",
          capability: "supportsWebFetch",
          category: "Research",
          command: "web fetch",
          description: "Fetch URLs",
          label: "Web fetch",
        },
      ],
    });
    mocks.recipes.mockReturnValue([
      recipe,
      { ...recipe, id: "weekly-briefing", title: "Weekly Briefing" },
    ]);
    mocks.tools.mockReturnValue([]);
    const { result } = renderHook(() => useProjectCapabilityCatalog());

    expect(
      result.current.items
        .filter((item) => item.kind === "recipe")
        .map((item) => item.capability.id),
    ).toEqual(["daily-briefing", "weekly-briefing"]);
    expect(result.current.items).toContainEqual(
      expect.objectContaining({
        label: "Notes",
        metadata: expect.objectContaining({ category: "Productivity" }),
      }),
    );
    expect(result.current.items).toContainEqual(
      expect.objectContaining({
        label: "Web fetch",
        metadata: expect.objectContaining({ category: "Research" }),
      }),
    );
  });

  it("publishes a function tool only as a runnable tool, never as an app", () => {
    mocks.appsData.mockReturnValue({ experiences: [], modelTools: [] });
    mocks.recipes.mockReturnValue([]);
    mocks.tools.mockReturnValue([
      {
        id: "get_weather",
        name: "Get Weather",
        description: "Get a weather forecast",
        category: "Research",
        isDefault: false,
      },
    ]);

    const { result } = renderHook(() => useProjectCapabilityCatalog());

    expect(result.current.items).toContainEqual(
      expect.objectContaining({
        id: "tool:get_weather",
        kind: "tool",
        label: "Get Weather",
        metadata: expect.objectContaining({
          category: "Research",
          toolId: "get_weather",
          toolRunnable: true,
        }),
      }),
    );
    expect(result.current.items.filter((item) => item.kind === "app")).toEqual([]);
  });
});
