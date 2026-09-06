import { updateTeammateSchema } from "@ngriffin_uk/polychat-schemas";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { listScopedTeammateSummaries } from "../listing";
import { publishTeammateToWorkspace } from "../publishTeammate";
import {
  createTeammate,
  deleteTeammate,
  getTeammateById,
  getUserTeammates,
  updateTeammate,
} from "../teammateCrud";

const OWNER_ID = 7;
const OTHER_ID = 9;
const TEAMMATE_ID = "agent-1";
const WORKSPACE_ID = "workspace-1";
const PROJECT_ID = "project-1";

function buildStoredTeammate(
  overrides: {
    id?: string;
    enabled_tools?: string[] | null;
    model?: string | null;
    owner_scope_type?: "user" | "workspace";
    owner_scope_id?: string;
    skill_ids?: string[] | null;
    user_id?: number;
  } = {},
) {
  return {
    id: TEAMMATE_ID,
    user_id: OWNER_ID,
    owner_scope_type: "user",
    owner_scope_id: String(OWNER_ID),
    derived_from_agent_id: null,
    name: "Researcher",
    description: "",
    avatar_url: null,
    servers: null,
    model: null,
    temperature: null,
    max_steps: null,
    system_prompt: null,
    few_shot_examples: null,
    enabled_tools: null,
    skill_ids: null,
    mode: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createContext(
  overrides: {
    agent?: ReturnType<typeof buildStoredTeammate> | null;
    currentUserId?: number;
    role?: "owner" | "admin" | "member" | null;
    workspaces?: { id: string }[];
    scopedTeammates?: ReturnType<typeof buildStoredTeammate>[];
    attachedProjects?: { id: string; name: string }[];
    flowProjects?: { id: string; name: string }[];
    listing?: { id: string; user_id: number } | null;
    install?: { id: string } | null;
    departedAuthorIds?: number[];
    projectTeammates?: ReturnType<typeof buildStoredTeammate>[];
    projectCapabilities?: { kind: string; capability_id: string; configuration: null }[];
  } = {},
) {
  const agent = overrides.agent === undefined ? buildStoredTeammate() : overrides.agent;
  const currentUser = { id: overrides.currentUserId ?? OWNER_ID, plan_id: "pro" };
  const repositories = {
    agents: {
      getTeammateById: vi.fn(async () => agent),
      getTeammatesByIds: vi.fn(async () => overrides.projectTeammates ?? []),
      getTeammatesForScopes: vi.fn(async () => overrides.scopedTeammates ?? []),
      createTeammate: vi.fn(async (record: Record<string, unknown>) => ({
        ...buildStoredTeammate(),
        id: "agent-copy",
        owner_scope_type: record.ownerScopeType,
        owner_scope_id: record.ownerScopeId,
        derived_from_agent_id: record.derivedFromTeammateId ?? null,
      })),
      updateTeammate: vi.fn(async () => undefined),
      deleteTeammate: vi.fn(async () => undefined),
    },
    authoredSkills: {
      listByScope: vi.fn(async () => []),
    },
    workspaces: {
      getWorkspace: vi.fn(async () => ({ id: WORKSPACE_ID })),
      getMembership: vi.fn(async (_workspaceId: string, memberId: number) => {
        if (overrides.departedAuthorIds?.includes(memberId)) {
          return null;
        }

        return overrides.role ? { role: overrides.role } : null;
      }),
      getProject: vi.fn(async () => ({ id: PROJECT_ID, workspace_id: WORKSPACE_ID })),
      listProjectCapabilities: vi.fn(async () => overrides.projectCapabilities ?? []),
      listWorkspaces: vi.fn(async () => overrides.workspaces ?? []),
      listProjectsWithCapability: vi.fn(async () => overrides.attachedProjects ?? []),
      listProjectsWithFlowStageTeammate: vi.fn(async () => overrides.flowProjects ?? []),
    },
    sharedAgents: {
      getSharedTeammateByTeammateId: vi.fn(async () => overrides.listing ?? null),
      deleteSharedTeammate: vi.fn(async () => undefined),
      getInstallByTeammateId: vi.fn(async () => overrides.install ?? null),
      uninstallTeammate: vi.fn(async () => undefined),
    },
  };

  return {
    context: {
      ensureDatabase: vi.fn(),
      user: currentUser,
      requireUser: vi.fn(() => currentUser),
      repositories,
    } as unknown as ServiceContext,
    repositories,
  };
}

describe("agent scope authorisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists clearing an agent's sampling override", async () => {
    const { context, repositories } = createContext();
    const input = updateTeammateSchema.parse({ temperature: null });

    await updateTeammate(context, TEAMMATE_ID, input);

    expect(repositories.agents.updateTeammate).toHaveBeenCalledWith(TEAMMATE_ID, {
      temperature: null,
    });
  });

  it("refuses a personal agent to anyone but its author", async () => {
    const { context } = createContext({ currentUserId: OTHER_ID });

    const error = await getTeammateById(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(403);
  });

  it("lets any workspace member read a workspace agent", async () => {
    const { context } = createContext({
      agent: buildStoredTeammate({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "member",
    });

    await expect(getTeammateById(context, TEAMMATE_ID)).resolves.toMatchObject({ id: TEAMMATE_ID });
  });

  it("refuses a workspace agent to a non-member", async () => {
    const { context } = createContext({
      agent: buildStoredTeammate({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: null,
    });

    const error = await getTeammateById(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(404);
  });

  it("refuses a plain member updating or deleting a workspace agent", async () => {
    const { context, repositories } = createContext({
      agent: buildStoredTeammate({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "member",
    });

    const updateError = await updateTeammate(context, TEAMMATE_ID, { name: "Repointed" }).catch(
      (thrown: unknown) => thrown,
    );
    const deleteError = await deleteTeammate(context, TEAMMATE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((updateError as AssistantError).statusCode).toBe(403);
    expect((deleteError as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.updateTeammate).not.toHaveBeenCalled();
    expect(repositories.agents.deleteTeammate).not.toHaveBeenCalled();
  });

  it("lets a workspace admin update a workspace agent", async () => {
    const { context, repositories } = createContext({
      agent: buildStoredTeammate({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "admin",
    });

    await updateTeammate(context, TEAMMATE_ID, { name: "Repointed" });

    expect(repositories.agents.updateTeammate).toHaveBeenCalledWith(TEAMMATE_ID, {
      name: "Repointed",
    });
  });

  it("lists personal agents alongside those of every workspace the person belongs to", async () => {
    const { context, repositories } = createContext({
      workspaces: [{ id: WORKSPACE_ID }, { id: "workspace-2" }],
      scopedTeammates: [
        buildStoredTeammate(),
        buildStoredTeammate({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      ],
    });

    const agents = await getUserTeammates(context);

    expect(repositories.agents.getTeammatesForScopes).toHaveBeenCalledWith(OWNER_ID, [
      WORKSPACE_ID,
      "workspace-2",
    ]);
    expect(agents).toHaveLength(2);
  });
});

describe("listScopedTeammateSummaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns nothing to an anonymous caller", async () => {
    const { context, repositories } = createContext({});

    await expect(listScopedTeammateSummaries(context)).resolves.toEqual([]);
    expect(repositories.agents.getTeammatesForScopes).not.toHaveBeenCalled();
  });

  it("returns the caller's own agents alongside the workspace agents they can read", async () => {
    const { context } = createContext({
      workspaces: [{ id: WORKSPACE_ID }],
      scopedTeammates: [
        buildStoredTeammate(),
        buildStoredTeammate({
          id: "agent-2",
          owner_scope_type: "workspace",
          owner_scope_id: WORKSPACE_ID,
        }),
      ],
    });

    const summaries = await listScopedTeammateSummaries(context, OWNER_ID);

    expect(summaries.map((summary) => [summary.id, summary.ownerScopeType])).toEqual([
      [TEAMMATE_ID, "user"],
      ["agent-2", "workspace"],
    ]);
  });

  it("returns only the agents a project has attached", async () => {
    const { context, repositories } = createContext({
      role: "member",
      projectCapabilities: [
        { kind: "skill", capability_id: "artifacts", configuration: null },
        { kind: "agent", capability_id: "agent-2", configuration: null },
      ],
      projectTeammates: [
        buildStoredTeammate({
          id: "agent-2",
          owner_scope_type: "workspace",
          owner_scope_id: WORKSPACE_ID,
        }),
      ],
    });

    const summaries = await listScopedTeammateSummaries(context, OWNER_ID, PROJECT_ID);

    expect(repositories.agents.getTeammatesByIds).toHaveBeenCalledWith(["agent-2"]);
    expect(summaries.map((summary) => summary.id)).toEqual(["agent-2"]);
  });

  it("drops a project agent whose author has left the workspace", async () => {
    const { context } = createContext({
      role: "member",
      departedAuthorIds: [OTHER_ID],
      projectCapabilities: [{ kind: "agent", capability_id: TEAMMATE_ID, configuration: null }],
      projectTeammates: [buildStoredTeammate({ user_id: OTHER_ID })],
    });

    await expect(listScopedTeammateSummaries(context, OWNER_ID, PROJECT_ID)).resolves.toEqual([]);
  });

  it("reports the model, skills and tools an agent names that this scope cannot run", async () => {
    const { context } = createContext({
      workspaces: [],
      scopedTeammates: [
        buildStoredTeammate({
          model: "retired-model-9000",
          skill_ids: ["artifacts", "not-a-real-skill"],
          enabled_tools: ["not_a_real_tool"],
        }),
      ],
    });

    const [summary] = await listScopedTeammateSummaries(context, OWNER_ID);

    expect(summary).toMatchObject({
      modelAvailable: false,
      unavailableSkillIds: ["not-a-real-skill"],
      unavailableToolIds: ["not_a_real_tool"],
    });
  });
});

describe("publishTeammateToWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies the agent into the workspace instead of repointing the personal record", async () => {
    const { context, repositories } = createContext({ role: "admin" });

    const published = await publishTeammateToWorkspace(context, TEAMMATE_ID, WORKSPACE_ID);

    expect(repositories.agents.createTeammate).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerScopeType: "workspace",
        ownerScopeId: WORKSPACE_ID,
        derivedFromTeammateId: TEAMMATE_ID,
      }),
    );
    expect(repositories.agents.updateTeammate).not.toHaveBeenCalled();
    expect(published.id).not.toBe(TEAMMATE_ID);
    expect(published.owner_scope_type).toBe("workspace");
  });

  it("refuses a plain member publishing into the workspace", async () => {
    const { context, repositories } = createContext({ role: "member" });

    const error = await publishTeammateToWorkspace(context, TEAMMATE_ID, WORKSPACE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.createTeammate).not.toHaveBeenCalled();
  });

  it("refuses to publish an agent the person cannot read", async () => {
    const { context, repositories } = createContext({ currentUserId: OTHER_ID, role: "admin" });

    const error = await publishTeammateToWorkspace(context, TEAMMATE_ID, WORKSPACE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.createTeammate).not.toHaveBeenCalled();
  });
});

describe("createTeammate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a personal agent when no workspace is named", async () => {
    const { context, repositories } = createContext({});

    await createTeammate(context, { name: "Researcher" });

    expect(repositories.agents.createTeammate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScopeType: "user", ownerScopeId: String(OWNER_ID) }),
    );
  });

  it("creates a workspace agent for an administrator of that workspace", async () => {
    const { context, repositories } = createContext({ role: "admin" });

    await createTeammate(context, { name: "Researcher", workspace_id: WORKSPACE_ID });

    expect(repositories.agents.createTeammate).toHaveBeenCalledWith(
      expect.objectContaining({ ownerScopeType: "workspace", ownerScopeId: WORKSPACE_ID }),
    );
  });

  it("refuses a plain member creating an agent the workspace would own", async () => {
    const { context, repositories } = createContext({ role: "member" });

    const error = await createTeammate(context, {
      name: "Researcher",
      workspace_id: WORKSPACE_ID,
    }).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.createTeammate).not.toHaveBeenCalled();
  });
});

describe("deleteTeammate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses while a project capability still references the agent", async () => {
    const { context, repositories } = createContext({
      attachedProjects: [{ id: "project-1", name: "Atlas" }],
    });

    const error = await deleteTeammate(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AssistantError);
    expect((error as AssistantError).statusCode).toBe(409);
    expect((error as AssistantError).message).toContain("Atlas");
    expect(repositories.agents.deleteTeammate).not.toHaveBeenCalled();
  });

  it("refuses while a flow stage still references the agent", async () => {
    const { context, repositories } = createContext({
      flowProjects: [{ id: "project-2", name: "Beacon" }],
    });

    const error = await deleteTeammate(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AssistantError);
    expect((error as AssistantError).statusCode).toBe(409);
    expect((error as AssistantError).message).toContain("Beacon");
    expect(repositories.agents.deleteTeammate).not.toHaveBeenCalled();
  });

  it("counts a project holding the agent as both capability and flow stage once", async () => {
    const { context } = createContext({
      attachedProjects: [{ id: "project-3", name: "Cinder" }],
      flowProjects: [{ id: "project-3", name: "Cinder" }],
    });

    const error = await deleteTeammate(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).message).toContain("1 project:");
  });

  it("unpublishes the shared listing and the install before deleting a shared agent", async () => {
    const { context, repositories } = createContext({
      listing: { id: "shared-1", user_id: OWNER_ID },
      install: { id: "install-1" },
    });

    await expect(deleteTeammate(context, TEAMMATE_ID)).resolves.toEqual({ success: true });

    expect(repositories.sharedAgents.deleteSharedTeammate).toHaveBeenCalledWith(
      OWNER_ID,
      "shared-1",
    );
    expect(repositories.sharedAgents.uninstallTeammate).toHaveBeenCalledWith(OWNER_ID, TEAMMATE_ID);
    expect(repositories.agents.deleteTeammate).toHaveBeenCalledWith(TEAMMATE_ID);
  });

  it("deletes an unreferenced agent without touching the marketplace", async () => {
    const { context, repositories } = createContext({});

    await expect(deleteTeammate(context, TEAMMATE_ID)).resolves.toEqual({ success: true });

    expect(repositories.sharedAgents.deleteSharedTeammate).not.toHaveBeenCalled();
    expect(repositories.sharedAgents.uninstallTeammate).not.toHaveBeenCalled();
    expect(repositories.agents.deleteTeammate).toHaveBeenCalledWith(TEAMMATE_ID);
  });
});
