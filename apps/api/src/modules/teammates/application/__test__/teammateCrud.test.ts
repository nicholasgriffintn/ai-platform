import { AssistantError } from "@ngriffin_uk/polychat-utility-server/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuthoredSkillRepository } from "~/modules/skills/infrastructure/AuthoredSkillRepository";
import { SharedTeammateRepository } from "~/modules/teammates/infrastructure/SharedTeammateRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { TeammateFeedbackRepository } from "~/modules/teammates/infrastructure/TeammateFeedbackRepository";
import { TeammateRepository } from "~/modules/teammates/infrastructure/TeammateRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { deleteTeammate, getTeammateById, updateTeammate } from "../teammateCrud";

const OWNER_ID = 7;
const OTHER_ID = 9;
const TEAMMATE_ID = "teammate-1";
const WORKSPACE_ID = "workspace-1";
const PROJECT_ID = "project-1";

function buildStoredTeammate(
  overrides: {
    id?: string;
    enabled_tools?: string[] | null;
    model?: string | null;
    owner_scope_type?: "user" | "workspace" | "platform";
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
    derived_from_teammate_id: null,
    workspace_default: false,
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
    teammate?: ReturnType<typeof buildStoredTeammate> | null;
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
    projectCapabilities?: {
      kind: string;
      capability_id: string;
      configuration: null;
      excluded?: number;
    }[];
  } = {},
) {
  const teammate = overrides.teammate === undefined ? buildStoredTeammate() : overrides.teammate;
  const currentUser = {
    id: overrides.currentUserId ?? OWNER_ID,
    plan_id: "pro",
  };
  const repositories = {
    teammates: {
      getTeammateById: vi.fn(async () => teammate),
      getTeammatesByIds: vi.fn(async () => overrides.projectTeammates ?? []),
      getTeammatesForScopes: vi.fn(async () => overrides.scopedTeammates ?? []),
      listPlatformTeammates: vi.fn(async () => []),
      upsertPlatformTeammates: vi.fn(async () => undefined),
      listWorkspaceDefaults: vi.fn(async () => []),
      createTeammate: vi.fn(async (record: Record<string, unknown>) => ({
        ...buildStoredTeammate(),
        id: "teammate-copy",
        owner_scope_type: record.ownerScopeType,
        owner_scope_id: record.ownerScopeId,
        derived_from_teammate_id: record.derivedFromTeammateId ?? null,
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
      getProject: vi.fn(async () => ({
        id: PROJECT_ID,
        workspace_id: WORKSPACE_ID,
      })),
      listProjectCapabilities: vi.fn(async () => overrides.projectCapabilities ?? []),
      listWorkspaces: vi.fn(async () => overrides.workspaces ?? []),
      listProjectsWithCapability: vi.fn(async () => overrides.attachedProjects ?? []),
      listProjectsWithFlowStageTeammate: vi.fn(async () => overrides.flowProjects ?? []),
    },
    teammateFeedback: {
      scorecardsFor: vi.fn(async () => new Map()),
    },
    teammateContexts: {
      listAllForTeammates: vi.fn(async () => []),
    },
    sharedTeammates: {
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
      repositories: fakeRepositories([
        [TeammateRepository, repositories.teammates],
        [AuthoredSkillRepository, repositories.authoredSkills],
        [WorkspaceRepository, repositories.workspaces],
        [TeammateFeedbackRepository, repositories.teammateFeedback],
        [TeammateContextRepository, repositories.teammateContexts],
        [SharedTeammateRepository, repositories.sharedTeammates],
      ]),
    } as unknown as ServiceContext,
    repositories,
  };
}

describe("teammate scope authorisation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("refuses a personal teammate to anyone but its author", async () => {
    const { context } = createContext({ currentUserId: OTHER_ID });

    const error = await getTeammateById(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(403);
  });

  it("refuses a workspace teammate to a non-member", async () => {
    const { context } = createContext({
      teammate: buildStoredTeammate({
        owner_scope_type: "workspace",
        owner_scope_id: WORKSPACE_ID,
      }),
      currentUserId: OTHER_ID,
      role: null,
    });

    const error = await getTeammateById(context, TEAMMATE_ID).catch((thrown: unknown) => thrown);

    expect((error as AssistantError).statusCode).toBe(404);
  });

  it("refuses a plain member updating or deleting a workspace teammate", async () => {
    const { context, repositories } = createContext({
      teammate: buildStoredTeammate({
        owner_scope_type: "workspace",
        owner_scope_id: WORKSPACE_ID,
      }),
      currentUserId: OTHER_ID,
      role: "member",
    });

    const updateError = await updateTeammate(context, TEAMMATE_ID, {
      name: "Repointed",
    }).catch((thrown: unknown) => thrown);
    const deleteError = await deleteTeammate(context, TEAMMATE_ID).catch(
      (thrown: unknown) => thrown,
    );

    expect((updateError as AssistantError).statusCode).toBe(403);
    expect((deleteError as AssistantError).statusCode).toBe(403);
    expect(repositories.teammates.updateTeammate).not.toHaveBeenCalled();
    expect(repositories.teammates.deleteTeammate).not.toHaveBeenCalled();
  });
});
