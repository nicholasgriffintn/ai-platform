import type { AgentSummary } from "@ngriffin_uk/polychat-schemas";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantActionCatalog } from "./useAssistantActionCatalog";

const mocks = vi.hoisted(() => ({
  agents: [] as AgentSummary[],
}));

vi.mock("./useCapabilityCatalog", () => ({
  useCapabilityCatalog: () => ({
    data: { agents: mocks.agents, experiences: [], modelTools: [], skills: [] },
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

vi.mock("~/state/stores/chatStore", () => ({
  useChatStore: (selector: (state: Record<string, boolean>) => unknown) =>
    selector({ isAuthenticated: true, isAuthenticationLoading: false }),
}));

function agentSummary(overrides: Partial<AgentSummary> & { id: string }): AgentSummary {
  return {
    name: `Agent ${overrides.id}`,
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

describe("assistant action catalogue agents", () => {
  beforeEach(() => {
    mocks.agents = [];
  });

  it("offers the scoped agents the server listed, keyed so the composer can resolve them", () => {
    mocks.agents = [
      agentSummary({ id: "researcher", ownerScopeType: "workspace" }),
      agentSummary({ id: "planner" }),
    ];

    const { result } = renderHook(() => useAssistantActionCatalog());
    const agentItems = result.current.items.filter((item) => item.kind === "agent");

    expect(agentItems.map((item) => item.id)).toEqual(["agent:researcher", "agent:planner"]);
    expect(agentItems.map((item) => item.metadata?.agentId)).toEqual(["researcher", "planner"]);
    expect(agentItems.map((item) => item.metadata?.category)).toEqual(["Workspace", "Personal"]);
  });

  it("offers no agents at all when the surface excludes them", () => {
    mocks.agents = [agentSummary({ id: "planner" })];

    const { result } = renderHook(() => useAssistantActionCatalog({ includeAgents: false }));

    expect(result.current.items.some((item) => item.kind === "agent")).toBe(false);
  });
});
