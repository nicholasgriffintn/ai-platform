import type { AgentSummary } from "@ngriffin_uk/polychat-schemas";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantActionCatalog } from "./useAssistantActionCatalog";

const mocks = vi.hoisted(() => ({
  agents: [] as AgentSummary[],
  teamMemberAgentIds: new Set<string>(),
}));

vi.mock("./useAgents", () => ({
  useAgents: () => ({ teamMemberAgentIds: mocks.teamMemberAgentIds }),
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
    mocks.teamMemberAgentIds = new Set();
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

  it("keeps a team's members out of the composer, leaving the orchestrator", () => {
    mocks.agents = [agentSummary({ id: "orchestrator" }), agentSummary({ id: "member" })];
    mocks.teamMemberAgentIds = new Set(["member"]);

    const { result } = renderHook(() => useAssistantActionCatalog());

    expect(
      result.current.items.filter((item) => item.kind === "agent").map((item) => item.id),
    ).toEqual(["agent:orchestrator"]);
  });

  it("offers no agents at all when the surface excludes them", () => {
    mocks.agents = [agentSummary({ id: "planner" })];

    const { result } = renderHook(() => useAssistantActionCatalog({ includeAgents: false }));

    expect(result.current.items.some((item) => item.kind === "agent")).toBe(false);
  });
});
