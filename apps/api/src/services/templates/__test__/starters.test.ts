import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";
import { AssistantError } from "~/utils/errors";

import { instantiateProjectStarter, listProjectStarters } from "../starters";

const validateProjectToolConfiguration = vi.hoisted(() =>
  vi.fn((_toolId: string, configuration: Record<string, unknown>) => configuration),
);

vi.mock("~/services/workspaces", () => ({
  getProject: vi.fn(async (_context: unknown, projectId: string) => ({ id: projectId })),
}));
vi.mock("~/services/workspaces/projectTools", () => ({ validateProjectToolConfiguration }));

const USER_ID = 4;

function createContext(role = "owner") {
  const currentUser = { id: USER_ID, plan_id: "pro" };
  const repositories = {
    teammates: {
      createTeammate: vi.fn(async (record: Record<string, unknown>) => ({
        id: `teammate-${String(record.name).toLowerCase()}`,
        user_id: USER_ID,
        owner_scope_type: "workspace",
        owner_scope_id: "workspace-1",
        derived_from_teammate_id: null,
        kind: record.kind ?? "colleague",
        name: record.name,
        description: record.description,
        avatar_url: null,
        servers: null,
        model: null,
        temperature: null,
        max_steps: null,
        system_prompt: record.systemPrompt ?? null,
        few_shot_examples: null,
        enabled_tools: record.enabledTools ?? null,
        skill_ids: null,
        mode: record.mode ?? null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      })),
    },
    workspaces: {
      getWorkspace: vi.fn(async () => ({ id: "workspace-1" })),
      getMembership: vi.fn(async () => ({ role })),
      createProjectWithCapabilities: vi.fn(
        async (
          _project: { name: string },
          _capabilities: Array<{ kind: string; capabilityId: string }>,
        ) => undefined,
      ),
    },
    audit: { createRecord: vi.fn(async () => undefined) },
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

describe("project starters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateProjectToolConfiguration.mockImplementation(
      (_toolId: string, configuration: Record<string, unknown>) => configuration,
    );
  });

  it("names the teammates a starter will hire before anyone commits to it", () => {
    const starter = listProjectStarters().starters.find(
      (candidate) => candidate.slug === "build-an-internal-tool",
    );

    expect(starter?.teammates).toEqual([
      { roleSlug: "developer", name: "Developer", title: "Developer" },
    ]);
  });

  it("hires the starter's teammates into the workspace and attaches them to the project", async () => {
    const { context, repositories } = createContext();

    await instantiateProjectStarter(
      context,
      USER_ID,
      "build-an-internal-tool",
      "workspace-1",
      "Rota tools",
    );

    expect(repositories.teammates.createTeammate).toHaveBeenCalledTimes(1);
    const call = repositories.workspaces.createProjectWithCapabilities.mock.calls[0];

    if (!call) {
      throw new Error("The starter did not create a project");
    }

    const [project, capabilities] = call;

    expect(project.name).toBe("Rota tools");
    expect(capabilities.filter((capability) => capability.kind === "teammate")).toEqual([
      expect.objectContaining({ capabilityId: "teammate-developer" }),
    ]);
    expect(capabilities.filter((capability) => capability.kind === "tool").length).toBeGreaterThan(
      0,
    );
  });

  it("refuses an unknown starter rather than creating an empty project", async () => {
    const { context, repositories } = createContext();

    await expect(
      instantiateProjectStarter(context, USER_ID, "not-a-starter", "workspace-1"),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(repositories.workspaces.createProjectWithCapabilities).not.toHaveBeenCalled();
  });

  it("validates the apps and tools before hiring, so a failure leaves no orphan teammate", async () => {
    const { context, repositories } = createContext();

    validateProjectToolConfiguration.mockImplementationOnce(() => {
      throw new AssistantError("Unknown project tool");
    });

    await expect(
      instantiateProjectStarter(context, USER_ID, "build-an-internal-tool", "workspace-1"),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(repositories.teammates.createTeammate).not.toHaveBeenCalled();
    expect(repositories.workspaces.createProjectWithCapabilities).not.toHaveBeenCalled();
  });

  it("refuses a workspace member, so a starter cannot hire teammates for the workspace", async () => {
    const { context, repositories } = createContext("member");

    await expect(
      instantiateProjectStarter(context, USER_ID, "build-an-internal-tool", "workspace-1"),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(repositories.teammates.createTeammate).not.toHaveBeenCalled();
  });
});
