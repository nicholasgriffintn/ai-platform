// @vitest-environment jsdom

import type { TeammateSummary } from "@ngriffin_uk/polychat-schemas";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantActionCatalog } from "./useAssistantActionCatalog";

const mocks = vi.hoisted(() => ({
  teammates: [] as TeammateSummary[],
}));

vi.mock("./useCapabilityCatalog", () => ({
  useCapabilityCatalog: () => ({
    data: { teammates: mocks.teammates, experiences: [], modelTools: [], skills: [] },
  }),
}));

vi.mock("./useConnectors", () => ({
  useRecipeConnectors: () => ({ data: undefined }),
}));

vi.mock("./useRecipes", () => ({
  useAssistantRecipes: () => ({ data: undefined }),
  useRecipeInstallations: () => ({ data: undefined }),
}));

vi.mock("./useSkills", () => ({
  usePersonalSkills: () => ({ query: { data: undefined } }),
}));

vi.mock("@ngriffin_uk/polychat-library-client", () => ({
  useChatStore: (selector: (state: Record<string, boolean>) => unknown) =>
    selector({ isAuthenticated: true, isAuthenticationLoading: false }),
}));

function teammateSummary(overrides: Partial<TeammateSummary> & { id: string }): TeammateSummary {
  return {
    name: `Teammate ${overrides.id}`,
    kind: "colleague",
    scorecard: { good: 0, bad: 0 },
    description: "",
    avatarUrl: null,
    model: null,
    modelAvailable: true,
    mode: null,
    ownerScopeType: "user",
    skillIds: [],
    toolIds: [],
    unavailableSkillIds: [],
    unavailableToolIds: [],
    ...overrides,
  };
}

describe("assistant action catalogue teammates", () => {
  beforeEach(() => {
    mocks.teammates = [];
  });

  it("offers the scoped teammates the server listed, keyed so the composer can resolve them", () => {
    mocks.teammates = [
      teammateSummary({ id: "researcher", ownerScopeType: "workspace" }),
      teammateSummary({ id: "planner" }),
    ];

    const { result } = renderHook(() => useAssistantActionCatalog());
    const teammateItems = result.current.items.filter((item) => item.kind === "teammate");

    expect(teammateItems.map((item) => item.id)).toEqual([
      "teammate:researcher",
      "teammate:planner",
    ]);
    expect(teammateItems.map((item) => item.metadata?.teammateId)).toEqual([
      "researcher",
      "planner",
    ]);
    expect(teammateItems.map((item) => item.metadata?.category)).toEqual(["Workspace", "Personal"]);
  });

  it("offers no teammates at all when the surface excludes them", () => {
    mocks.teammates = [teammateSummary({ id: "planner" })];

    const { result } = renderHook(() => useAssistantActionCatalog({ includeTeammates: false }));

    expect(result.current.items.some((item) => item.kind === "teammate")).toBe(false);
  });
});
