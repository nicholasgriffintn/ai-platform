import type { AgentResponse, WorkspaceSummary } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProjectSurface, PERSONAL_SURFACE } from "~/lib/capability-surfaces";

import { useCapabilityAuthoring, type CapabilityAuthoringInput } from "./useCapabilityAuthoring";

const navigate = vi.fn();
const agentList: AgentResponse[] = [];
const workspaceList: WorkspaceSummary[] = [];

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("~/state/stores/chatStore", () => ({
  useChatStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 7 } }),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: { workspaces: workspaceList }, isLoading: false }),
  useAddProjectCapability: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useRemoveProjectCapability: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));

vi.mock("~/hooks/useAgents", () => ({
  AGENTS_QUERY_KEYS: { all: ["agents"], detail: (id: string) => ["agents", id] },
  useAgent: () => ({ data: undefined, isLoading: false, error: null }),
  usePublishAgentToWorkspace: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useAgents: () => ({
    agents: agentList,
    isLoadingAgents: false,
    deleteAgentAsync: vi.fn(),
    deleteAgentError: null,
    deletingAgentId: undefined,
    isDeletingAgent: false,
    resetAgentDeletion: vi.fn(),
  }),
}));

function agent(overrides: Partial<AgentResponse>): AgentResponse {
  return {
    id: "agent-1",
    user_id: 7,
    owner_scope_type: "user",
    owner_scope_id: "7",
    derived_from_agent_id: null,
    name: "Researcher",
    description: "Digs through sources.",
    avatar_url: null,
    servers: [],
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    skill_ids: [],
    mode: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

function workspace(overrides: Partial<WorkspaceSummary>): WorkspaceSummary {
  return {
    id: "workspace-1",
    name: "Research",
    description: "",
    colour: "blue",
    role: "member",
    memberCount: 2,
    projectCount: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function authoringInput(
  overrides: Partial<CapabilityAuthoringInput> = {},
): CapabilityAuthoringInput {
  return {
    capabilities: [],
    currentUserId: 7,
    skillDeletion: {
      delete: vi.fn(async () => undefined),
      error: null,
      isPending: false,
      reset: vi.fn(),
    },
    surface: PERSONAL_SURFACE,
    ...overrides,
  };
}

function renderAuthoring(overrides: Partial<CapabilityAuthoringInput> = {}) {
  return renderHook(() => useCapabilityAuthoring(authoringInput(overrides)), { wrapper });
}

function headerAction(
  result: ReturnType<typeof renderAuthoring>["result"],
  label: string,
): (() => void) | undefined {
  return result.current.headerActions?.find((action) => action.label === label)?.onClick;
}

beforeEach(() => {
  navigate.mockReset();
  agentList.length = 0;
  workspaceList.length = 0;
});

describe("capability library agent authoring", () => {
  it("opens the personal agent editor from the library's add-agent action", () => {
    const { result } = renderAuthoring();

    headerAction(result, "Add agent")?.();

    expect(navigate).toHaveBeenCalledWith("/chat/agents/new");
    expect(headerAction(result, "Attach agent")).toBeUndefined();
  });

  it("opens the project agent editor and offers attachment inside a project", () => {
    const { result } = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    headerAction(result, "Add agent")?.();

    expect(navigate).toHaveBeenCalledWith("/work/workspace-1/projects/project-1/agents/new");
    expect(headerAction(result, "Attach agent")).toBeDefined();
  });

  it("withholds authoring actions from a project member who cannot manage capabilities", () => {
    const { result } = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: false },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(result.current.headerActions).toBeUndefined();
  });

  it("only lets a viewer manage the agents they own or administer", () => {
    agentList.push(
      agent({ id: "mine", owner_scope_type: "user", owner_scope_id: "7", user_id: 7 }),
      agent({ id: "someone-elses", owner_scope_type: "user", owner_scope_id: "9", user_id: 9 }),
      agent({ id: "administered", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
      agent({ id: "read-only", owner_scope_type: "workspace", owner_scope_id: "workspace-2" }),
    );
    workspaceList.push(
      workspace({ id: "workspace-1", role: "admin" }),
      workspace({ id: "workspace-2", role: "member" }),
    );

    const { result } = renderAuthoring();

    expect(result.current.agentActions.canManage("mine")).toBe(true);
    expect(result.current.agentActions.canManage("administered")).toBe(true);
    expect(result.current.agentActions.canManage("someone-elses")).toBe(false);
    expect(result.current.agentActions.canManage("read-only")).toBe(false);
  });

  it("offers marketplace sharing only for a personally-owned agent the viewer manages", () => {
    agentList.push(
      agent({ id: "mine", owner_scope_type: "user", owner_scope_id: "7", user_id: 7 }),
      agent({ id: "someone-elses", owner_scope_type: "user", owner_scope_id: "9", user_id: 9 }),
      agent({ id: "administered", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
    );
    workspaceList.push(workspace({ id: "workspace-1", role: "admin" }));

    const { result } = renderAuthoring();

    expect(result.current.agentActions.canShare("mine")).toBe(true);
    expect(result.current.agentActions.canShare("someone-elses")).toBe(false);
    expect(result.current.agentActions.canManage("administered")).toBe(true);
    expect(result.current.agentActions.canShare("administered")).toBe(false);
  });

  it("opens the sharing dialog against the agent the card asked to share", () => {
    agentList.push(agent({ id: "mine", name: "Researcher", description: "Digs through sources." }));

    const { result } = renderAuthoring();

    expect(result.current.shareAgent.agent).toBeNull();

    act(() => result.current.agentActions.onShare("mine"));

    expect(result.current.shareAgent.agent).toEqual({
      id: "mine",
      name: "Researcher",
      description: "Digs through sources.",
    });

    act(() => result.current.shareAgent.close());

    expect(result.current.shareAgent.agent).toBeNull();
  });

  it("offers shared-agent browsing personally but not inside a project", () => {
    const personal = renderAuthoring();

    expect(headerAction(personal.result, "Browse shared agents")).toBeDefined();

    const project = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(headerAction(project.result, "Browse shared agents")).toBeUndefined();
  });

  it("offers only the workspace agents a project has not already attached", () => {
    agentList.push(
      agent({ id: "attached", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
      agent({ id: "spare", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
      agent({
        id: "other-workspace",
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-2",
      }),
      agent({ id: "personal" }),
    );
    workspaceList.push(workspace({ id: "workspace-1", role: "admin" }));

    const { result } = renderAuthoring({
      capabilities: [
        {
          id: "capability-1",
          kind: "agent",
          capabilityId: "attached",
          configuration: {},
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(result.current.attachAgent.agents.map((entry) => entry.id)).toEqual(["spare"]);
  });

  it("attaches a chosen agent to the project as an agent capability", async () => {
    const addCapability = vi.fn(async () => undefined);

    const { result } = renderAuthoring({
      projectActions: { addCapability, canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    await result.current.attachAgent.attach("spare");

    expect(addCapability).toHaveBeenCalledWith("agent", "spare");
  });
});
