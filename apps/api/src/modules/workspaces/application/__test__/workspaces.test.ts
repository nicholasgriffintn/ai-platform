import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/modules/email/application", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

import { ErrorType } from "@ngriffin_uk/polychat-utility-server/errors";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { AuditRepository } from "~/modules/audit/infrastructure/AuditRepository";
import { OutputRepository } from "~/modules/outputs/infrastructure/OutputRepository";
import { TeammateContextRepository } from "~/modules/teammates/infrastructure/TeammateContextRepository";
import { UsageEventRepository } from "~/modules/usage/infrastructure/UsageEventRepository";
import type {
  ProjectRow,
  WorkspaceInvitationRow,
  WorkspaceMemberRow,
  WorkspaceRow,
} from "~/modules/workspaces/infrastructure/WorkspaceRepository";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { acceptWorkspaceInvitation, inviteWorkspaceMember } from "../index";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const WORKSPACE_ID = "workspace-1";
const PROJECT_ID = "project-1";

const workspace: WorkspaceRow = {
  id: WORKSPACE_ID,
  name: "Product",
  description: "Product planning",
  colour: "#E8643C",
  created_by: 1,
  created_at: "2026-08-01T09:00:00.000Z",
  updated_at: null,
};

const owner: WorkspaceMemberRow = {
  user_id: 1,
  name: "Owner",
  email: "owner@example.com",
  avatar_url: null,
  role: "owner",
  joined_at: "2026-08-01T09:00:00.000Z",
};

const project: ProjectRow = {
  id: PROJECT_ID,
  workspace_id: WORKSPACE_ID,
  name: "Launch",
  description: "Launch planning",
  instructions: "Keep decisions concise.",
  colour: "#2563EB",
  created_by: 1,
  archived_at: null,
  created_at: "2026-08-02T09:00:00.000Z",
  updated_at: null,
  conversation_count: 0,
  capability_count: 0,
};

function createHarness(params?: {
  user?: { id: number; email: string; plan_id?: string };
  role?: "owner" | "admin" | "member" | null;
}) {
  const user = {
    id: 1,
    email: "owner@example.com",
    plan_id: "pro",
    ...params?.user,
  };
  const role = params?.role === undefined ? "owner" : params.role;
  const repositories = {
    listWorkspaces: vi.fn().mockResolvedValue([]),
    getWorkspace: vi.fn().mockResolvedValue(workspace),
    getMembership: vi.fn().mockResolvedValue(role ? { role } : null),
    listProjects: vi.fn().mockResolvedValue([]),
    listMembers: vi.fn().mockResolvedValue([owner]),
    listInvitations: vi.fn().mockResolvedValue([]),
    upsertInvitation: vi.fn(),
    revokeInvitation: vi.fn().mockResolvedValue(true),
    getInvitationByTokenHash: vi.fn(),
    acceptInvitation: vi.fn().mockResolvedValue(undefined),
    createProject: vi.fn().mockResolvedValue(undefined),
    updateProject: vi.fn().mockResolvedValue(undefined),
    deleteWorkspace: vi.fn().mockResolvedValue(undefined),
    getProject: vi.fn().mockResolvedValue(project),
    listProjectCapabilities: vi.fn().mockResolvedValue([]),
    addProjectCapability: vi.fn().mockResolvedValue(undefined),
    removeProjectCapability: vi.fn().mockResolvedValue(undefined),
    listProjectConversations: vi.fn().mockResolvedValue([]),
  };
  const usageEvents = {
    summariseWorkspacePeriodBy: vi.fn().mockResolvedValue([]),
  };
  const audit = { createRecord: vi.fn().mockResolvedValue(undefined) };
  const outputs = { listWorkspaceOutputRoots: vi.fn().mockResolvedValue([]) };
  const context = {
    env: { APP_BASE_URL: "https://work.polychat.test/" },
    requireUser: vi.fn().mockReturnValue(user),
    repositories: fakeRepositories([
      [WorkspaceRepository, repositories],
      [AuditRepository, audit],
      [OutputRepository, outputs],
      [UsageEventRepository, usageEvents],
      [
        TeammateContextRepository,
        {
          listForWorkspaceProjects: vi.fn().mockResolvedValue([]),
        },
      ],
    ]),
  } as unknown as ServiceContext;

  return { context, repositories, audit, outputs, usageEvents };
}

function invitation(overrides: Partial<WorkspaceInvitationRow> = {}): WorkspaceInvitationRow {
  return {
    id: "invitation-1",
    workspace_id: WORKSPACE_ID,
    email: "invitee@example.com",
    role: "member",
    token_hash: "stored-hash",
    status: "pending",
    invited_by: 1,
    accepted_by: null,
    expires_at: "2026-08-17T12:00:00.000Z",
    accepted_at: null,
    created_at: "2026-08-10T12:00:00.000Z",
    updated_at: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("workspace invitation lifecycle", () => {
  it("binds acceptance to the invited email address", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { context, repositories } = createHarness({
      user: { id: 2, email: "different@example.com" },
    });

    repositories.getInvitationByTokenHash.mockResolvedValue(invitation());

    await expect(acceptWorkspaceInvitation(context, "a".repeat(64))).rejects.toMatchObject({
      type: ErrorType.FORBIDDEN,
      statusCode: 403,
      message: "Sign in with the email address that received this invitation",
    });
    expect(repositories.acceptInvitation).not.toHaveBeenCalled();
  });

  it("accepts a valid invitation once and rejects replay with the same token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const { context, repositories } = createHarness({
      user: { id: 2, email: " INVITEE@example.com " },
      role: "member",
    });
    let storedInvitation = invitation();

    repositories.getInvitationByTokenHash.mockImplementation(async () => storedInvitation);
    repositories.acceptInvitation.mockImplementation(async () => {
      storedInvitation = invitation({
        status: "accepted",
        token_hash: "consumed:invitation-1",
      });
    });

    const result = await acceptWorkspaceInvitation(context, "a".repeat(64));

    expect(repositories.acceptInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "invitation-1",
        status: "pending",
      }),
      2,
    );
    expect(result).toMatchObject({
      id: WORKSPACE_ID,
      role: "member",
      invitations: [],
    });
    await expect(acceptWorkspaceInvitation(context, "a".repeat(64))).rejects.toMatchObject({
      type: ErrorType.NOT_FOUND,
      statusCode: 404,
    });
    expect(repositories.acceptInvitation).toHaveBeenCalledTimes(1);
  });

  it("prevents administrators from escalating invitations to the admin role", async () => {
    const { context, repositories } = createHarness({ role: "admin" });

    await expect(
      inviteWorkspaceMember(context, WORKSPACE_ID, {
        email: "invitee@example.com",
        role: "admin",
      }),
    ).rejects.toMatchObject({ type: ErrorType.FORBIDDEN, statusCode: 403 });
    expect(repositories.upsertInvitation).not.toHaveBeenCalled();
  });
});
