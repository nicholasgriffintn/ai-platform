import type { TeammateResponse, WorkspaceSummary } from "@ngriffin_uk/polychat-schemas";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getProjectSurface, PERSONAL_SURFACE } from "~/lib/capability-surfaces";

import { useCapabilityAuthoring, type CapabilityAuthoringInput } from "./useCapabilityAuthoring";

const navigate = vi.fn();
const teammateList: TeammateResponse[] = [];
const workspaceList: WorkspaceSummary[] = [];

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@ngriffin_uk/polychat-library-react", () => ({
  useChatStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 7 } }),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
  useWorkspaces: () => ({ data: { workspaces: workspaceList }, isLoading: false }),
  useAddProjectCapability: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useRemoveProjectCapability: () => ({ isPending: false, error: null, mutate: vi.fn() }),
}));

const hireTeammateMock = vi.fn(async () => teammate({ id: "teammate-hired" }));

vi.mock("~/hooks/useTeammates", () => ({
  TEAMMATES_QUERY_KEYS: { all: ["teammates"], detail: (id: string) => ["teammates", id] },
  useTeammate: () => ({ data: undefined, isLoading: false, error: null }),
  usePublishTeammateToWorkspace: () => ({ isPending: false, error: null, mutateAsync: vi.fn() }),
  useTeammates: () => ({
    teammates: teammateList,
    isLoadingTeammates: false,
    deleteTeammateAsync: vi.fn(),
    deleteTeammateError: null,
    deletingTeammateId: undefined,
    isDeletingTeammate: false,
    resetTeammateDeletion: vi.fn(),
    hireTeammate: hireTeammateMock,
    isHiringTeammate: false,
    hireTeammateError: null,
    resetHireTeammate: vi.fn(),
  }),
}));

function teammate(overrides: Partial<TeammateResponse>): TeammateResponse {
  return {
    id: "teammate-1",
    user_id: 7,
    owner_scope_type: "user",
    owner_scope_id: "7",
    derived_from_teammate_id: null,
    kind: "colleague",
    workspace_default: false,
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

function addChoice(
  result: ReturnType<typeof renderAuthoring>["result"],
  label: string,
): (() => void) | undefined {
  return result.current.addChoices.find((choice) => choice.label === label)?.onSelect;
}

beforeEach(() => {
  navigate.mockReset();
  hireTeammateMock.mockClear();
  teammateList.length = 0;
  workspaceList.length = 0;
});

describe("capability library teammate authoring", () => {
  it("opens the personal teammate editor from the library's build-from-scratch action", () => {
    const { result } = renderAuthoring();

    addChoice(result, "Build one from scratch")?.();

    expect(navigate).toHaveBeenCalledWith("/chat/teammates/new");
    expect(addChoice(result, "Attach a teammate")).toBeUndefined();
    expect(addChoice(result, "Browse shared teammates")).toBeDefined();
  });

  it("opens the project teammate editor and offers attachment inside a project", () => {
    const { result } = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    addChoice(result, "Build one from scratch")?.();

    expect(navigate).toHaveBeenCalledWith("/work/workspace-1/projects/project-1/teammates/new");
    expect(addChoice(result, "Attach a teammate")).toBeDefined();
    expect(addChoice(result, "Browse shared teammates")).toBeUndefined();
  });

  it("attaches a teammate hired inside a project and opens its editor", async () => {
    const addCapability = vi.fn(async () => undefined);
    const { result } = renderAuthoring({
      projectActions: { addCapability, canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    await act(async () => {
      await result.current.hireTeammate.hire({ role_slug: "research-analyst" });
    });

    expect(hireTeammateMock).toHaveBeenCalledWith({ role_slug: "research-analyst" });
    expect(addCapability).toHaveBeenCalledWith("teammate", "teammate-hired");
    expect(navigate).toHaveBeenCalledWith(
      "/work/workspace-1/projects/project-1/teammates/teammate-hired",
    );
  });

  it("withholds authoring actions from a project member who cannot manage capabilities", () => {
    const { result } = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: false },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(result.current.addChoices).toEqual([]);
  });

  it("only lets a viewer manage the teammates they own or administer", () => {
    teammateList.push(
      teammate({ id: "mine", owner_scope_type: "user", owner_scope_id: "7", user_id: 7 }),
      teammate({ id: "someone-elses", owner_scope_type: "user", owner_scope_id: "9", user_id: 9 }),
      teammate({
        id: "administered",
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-1",
      }),
      teammate({ id: "read-only", owner_scope_type: "workspace", owner_scope_id: "workspace-2" }),
    );
    workspaceList.push(
      workspace({ id: "workspace-1", role: "admin" }),
      workspace({ id: "workspace-2", role: "member" }),
    );

    const { result } = renderAuthoring();

    expect(result.current.teammateActions.canManage("mine")).toBe(true);
    expect(result.current.teammateActions.canManage("administered")).toBe(true);
    expect(result.current.teammateActions.canManage("someone-elses")).toBe(false);
    expect(result.current.teammateActions.canManage("read-only")).toBe(false);
  });

  it("offers marketplace sharing only for a personally-owned teammate the viewer manages", () => {
    teammateList.push(
      teammate({ id: "mine", owner_scope_type: "user", owner_scope_id: "7", user_id: 7 }),
      teammate({ id: "someone-elses", owner_scope_type: "user", owner_scope_id: "9", user_id: 9 }),
      teammate({
        id: "administered",
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-1",
      }),
    );
    workspaceList.push(workspace({ id: "workspace-1", role: "admin" }));

    const { result } = renderAuthoring();

    expect(result.current.teammateActions.canShare("mine")).toBe(true);
    expect(result.current.teammateActions.canShare("someone-elses")).toBe(false);
    expect(result.current.teammateActions.canManage("administered")).toBe(true);
    expect(result.current.teammateActions.canShare("administered")).toBe(false);
  });

  it("opens the sharing dialog against the teammate the card asked to share", () => {
    teammateList.push(
      teammate({ id: "mine", name: "Researcher", description: "Digs through sources." }),
    );

    const { result } = renderAuthoring();

    expect(result.current.shareTeammate.teammate).toBeNull();

    act(() => result.current.teammateActions.onShare("mine"));

    expect(result.current.shareTeammate.teammate).toEqual({
      id: "mine",
      name: "Researcher",
      description: "Digs through sources.",
    });

    act(() => result.current.shareTeammate.close());

    expect(result.current.shareTeammate.teammate).toBeNull();
  });

  it("offers shared-teammate browsing personally but not inside a project", () => {
    const personal = renderAuthoring();

    expect(addChoice(personal.result, "Browse shared teammates")).toBeDefined();

    const project = renderAuthoring({
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(addChoice(project.result, "Browse shared teammates")).toBeUndefined();
  });

  it("offers only the workspace teammates a project has not already attached", () => {
    teammateList.push(
      teammate({ id: "attached", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
      teammate({ id: "spare", owner_scope_type: "workspace", owner_scope_id: "workspace-1" }),
      teammate({
        id: "other-workspace",
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-2",
      }),
      teammate({ id: "personal" }),
    );
    workspaceList.push(workspace({ id: "workspace-1", role: "admin" }));

    const { result } = renderAuthoring({
      capabilities: [
        {
          id: "capability-1",
          kind: "teammate",
          capabilityId: "attached",
          configuration: {},
          createdAt: "2026-08-01T00:00:00.000Z",
        },
      ],
      projectActions: { addCapability: vi.fn(async () => undefined), canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    expect(result.current.attachTeammate.teammates.map((entry) => entry.id)).toEqual(["spare"]);
  });

  it("attaches a chosen teammate to the project as an teammate capability", async () => {
    const addCapability = vi.fn(async () => undefined);

    const { result } = renderAuthoring({
      projectActions: { addCapability, canManage: true },
      surface: getProjectSurface("workspace-1", "project-1"),
    });

    await result.current.attachTeammate.attach("spare");

    expect(addCapability).toHaveBeenCalledWith("teammate", "spare");
  });
});
