import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { deleteAgent, getAgentById, getUserAgents, updateAgent } from "../agentCrud";
import { publishAgentToWorkspace } from "../publishAgent";

const OWNER_ID = 7;
const OTHER_ID = 9;
const AGENT_ID = "agent-1";
const WORKSPACE_ID = "workspace-1";

function buildStoredAgent(
  overrides: {
    owner_scope_type?: "user" | "workspace";
    owner_scope_id?: string;
    user_id?: number;
  } = {},
) {
  return {
    id: AGENT_ID,
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
    is_team_agent: false,
    team_id: null,
    team_role: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createContext(
  overrides: {
    agent?: ReturnType<typeof buildStoredAgent> | null;
    currentUserId?: number;
    role?: "owner" | "admin" | "member" | null;
    workspaces?: { id: string }[];
    scopedAgents?: ReturnType<typeof buildStoredAgent>[];
    attachedProjects?: { id: string; name: string }[];
    flowProjects?: { id: string; name: string }[];
    listing?: { id: string; user_id: number } | null;
    install?: { id: string } | null;
  } = {},
) {
  const agent = overrides.agent === undefined ? buildStoredAgent() : overrides.agent;
  const currentUser = { id: overrides.currentUserId ?? OWNER_ID, plan_id: "pro" };
  const repositories = {
    agents: {
      getAgentById: vi.fn(async () => agent),
      getAgentsForScopes: vi.fn(async () => overrides.scopedAgents ?? []),
      createAgent: vi.fn(async (record: Record<string, unknown>) => ({
        ...buildStoredAgent(),
        id: "agent-copy",
        owner_scope_type: record.ownerScopeType,
        owner_scope_id: record.ownerScopeId,
        derived_from_agent_id: record.derivedFromAgentId,
      })),
      updateAgent: vi.fn(async () => undefined),
      deleteAgent: vi.fn(async () => undefined),
    },
    workspaces: {
      getWorkspace: vi.fn(async () => ({ id: WORKSPACE_ID })),
      getMembership: vi.fn(async () => (overrides.role ? { role: overrides.role } : null)),
      listWorkspaces: vi.fn(async () => overrides.workspaces ?? []),
      listProjectsWithCapability: vi.fn(async () => overrides.attachedProjects ?? []),
      listProjectsWithFlowStageAgent: vi.fn(async () => overrides.flowProjects ?? []),
    },
    sharedAgents: {
      getSharedAgentByAgentId: vi.fn(async () => overrides.listing ?? null),
      deleteSharedAgent: vi.fn(async () => undefined),
      getInstallByAgentId: vi.fn(async () => overrides.install ?? null),
      uninstallAgent: vi.fn(async () => undefined),
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

  it("refuses a personal agent to anyone but its author", async () => {
    const { context } = createContext({ currentUserId: OTHER_ID });

    const error = await getAgentById(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(403);
  });

  it("lets any workspace member read a workspace agent", async () => {
    const { context } = createContext({
      agent: buildStoredAgent({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "member",
    });

    await expect(getAgentById(context, AGENT_ID)).resolves.toMatchObject({ id: AGENT_ID });
  });

  it("refuses a workspace agent to a non-member", async () => {
    const { context } = createContext({
      agent: buildStoredAgent({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: null,
    });

    const error = await getAgentById(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(404);
  });

  it("refuses a plain member updating or deleting a workspace agent", async () => {
    const { context, repositories } = createContext({
      agent: buildStoredAgent({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "member",
    });

    const updateError = await updateAgent(context, AGENT_ID, { name: "Repointed" }).catch(
      (thrown: unknown) => thrown,
    );
    const deleteError = await deleteAgent(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect((updateError as AssistantError).statusCode).toBe(403);
    expect((deleteError as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.updateAgent).not.toHaveBeenCalled();
    expect(repositories.agents.deleteAgent).not.toHaveBeenCalled();
  });

  it("lets a workspace admin update a workspace agent", async () => {
    const { context, repositories } = createContext({
      agent: buildStoredAgent({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      currentUserId: OTHER_ID,
      role: "admin",
    });

    await updateAgent(context, AGENT_ID, { name: "Repointed" });

    expect(repositories.agents.updateAgent).toHaveBeenCalledWith(AGENT_ID, { name: "Repointed" });
  });

  it("lists personal agents alongside those of every workspace the person belongs to", async () => {
    const { context, repositories } = createContext({
      workspaces: [{ id: WORKSPACE_ID }, { id: "workspace-2" }],
      scopedAgents: [
        buildStoredAgent(),
        buildStoredAgent({ owner_scope_type: "workspace", owner_scope_id: WORKSPACE_ID }),
      ],
    });

    const agents = await getUserAgents(context);

    expect(repositories.agents.getAgentsForScopes).toHaveBeenCalledWith(OWNER_ID, [
      WORKSPACE_ID,
      "workspace-2",
    ]);
    expect(agents).toHaveLength(2);
  });
});

describe("publishAgentToWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("copies the agent into the workspace instead of repointing the personal record", async () => {
    const { context, repositories } = createContext({ role: "admin" });

    const published = await publishAgentToWorkspace(context, AGENT_ID, WORKSPACE_ID);

    expect(repositories.agents.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerScopeType: "workspace",
        ownerScopeId: WORKSPACE_ID,
        derivedFromAgentId: AGENT_ID,
      }),
    );
    expect(repositories.agents.updateAgent).not.toHaveBeenCalled();
    expect(published.id).not.toBe(AGENT_ID);
    expect(published.owner_scope_type).toBe("workspace");
  });

  it("refuses a plain member publishing into the workspace", async () => {
    const { context, repositories } = createContext({ role: "member" });

    const error = await publishAgentToWorkspace(context, AGENT_ID, WORKSPACE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.createAgent).not.toHaveBeenCalled();
  });

  it("refuses to publish an agent the person cannot read", async () => {
    const { context, repositories } = createContext({ currentUserId: OTHER_ID, role: "admin" });

    const error = await publishAgentToWorkspace(context, AGENT_ID, WORKSPACE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((error as AssistantError).statusCode).toBe(403);
    expect(repositories.agents.createAgent).not.toHaveBeenCalled();
  });
});

describe("deleteAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses while a project capability still references the agent", async () => {
    const { context, repositories } = createContext({
      attachedProjects: [{ id: "project-1", name: "Atlas" }],
    });

    const error = await deleteAgent(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AssistantError);
    expect((error as AssistantError).statusCode).toBe(409);
    expect((error as AssistantError).message).toContain("Atlas");
    expect(repositories.agents.deleteAgent).not.toHaveBeenCalled();
  });

  it("refuses while a flow stage still references the agent", async () => {
    const { context, repositories } = createContext({
      flowProjects: [{ id: "project-2", name: "Beacon" }],
    });

    const error = await deleteAgent(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AssistantError);
    expect((error as AssistantError).statusCode).toBe(409);
    expect((error as AssistantError).message).toContain("Beacon");
    expect(repositories.agents.deleteAgent).not.toHaveBeenCalled();
  });

  it("counts a project holding the agent as both capability and flow stage once", async () => {
    const { context } = createContext({
      attachedProjects: [{ id: "project-3", name: "Cinder" }],
      flowProjects: [{ id: "project-3", name: "Cinder" }],
    });

    const error = await deleteAgent(context, AGENT_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).message).toContain("1 project:");
  });

  it("unpublishes the shared listing and the install before deleting a shared agent", async () => {
    const { context, repositories } = createContext({
      listing: { id: "shared-1", user_id: OWNER_ID },
      install: { id: "install-1" },
    });

    await expect(deleteAgent(context, AGENT_ID)).resolves.toEqual({ success: true });

    expect(repositories.sharedAgents.deleteSharedAgent).toHaveBeenCalledWith(OWNER_ID, "shared-1");
    expect(repositories.sharedAgents.uninstallAgent).toHaveBeenCalledWith(OWNER_ID, AGENT_ID);
    expect(repositories.agents.deleteAgent).toHaveBeenCalledWith(AGENT_ID);
  });

  it("deletes an unreferenced agent without touching the marketplace", async () => {
    const { context, repositories } = createContext({});

    await expect(deleteAgent(context, AGENT_ID)).resolves.toEqual({ success: true });

    expect(repositories.sharedAgents.deleteSharedAgent).not.toHaveBeenCalled();
    expect(repositories.sharedAgents.uninstallAgent).not.toHaveBeenCalled();
    expect(repositories.agents.deleteAgent).toHaveBeenCalledWith(AGENT_ID);
  });
});
