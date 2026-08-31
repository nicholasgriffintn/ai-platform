import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { deleteAgent } from "../agentCrud";

const OWNER_ID = 7;
const AGENT_ID = "agent-1";

function createContext(overrides: {
  attachedProjects?: { id: string; name: string }[];
  flowProjects?: { id: string; name: string }[];
  listing?: { id: string; user_id: number } | null;
  install?: { id: string } | null;
}) {
  const repositories = {
    agents: {
      getAgentById: vi.fn(async () => ({
        id: AGENT_ID,
        user_id: OWNER_ID,
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
      })),
      deleteAgent: vi.fn(async () => undefined),
    },
    workspaces: {
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
      requireUser: vi.fn(() => ({ id: OWNER_ID })),
      repositories,
    } as unknown as ServiceContext,
    repositories,
  };
}

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
