import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { instantiateProjectStarter } from "../starters";

const validateProjectToolConfiguration = vi.hoisted(() =>
  vi.fn((_toolId: string, configuration: Record<string, unknown>) => configuration),
);

vi.mock("~/modules/workspaces/application", () => ({
  getProject: vi.fn(async (_context: unknown, projectId: string) => ({ id: projectId })),
}));
vi.mock("~/modules/workspaces/application/projectTools", () => ({
  validateProjectToolConfiguration,
}));

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
      repositories: fakeRepositories([
        [TeammateRepository, repositories.teammates],
        [WorkspaceRepository, repositories.workspaces],
        [AuditRepository, repositories.audit],
      ]),
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

  it("refuses a workspace member, so a starter cannot hire teammates for the workspace", async () => {
    const { context, repositories } = createContext("member");

    await expect(
      instantiateProjectStarter(context, USER_ID, "build-an-internal-tool", "workspace-1"),
    ).rejects.toBeInstanceOf(AssistantError);
    expect(repositories.teammates.createTeammate).not.toHaveBeenCalled();
  });
});
