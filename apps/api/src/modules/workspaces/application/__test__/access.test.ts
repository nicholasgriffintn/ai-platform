import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/infrastructure/context/serviceContext";
import { fakeRepositories } from "~/infrastructure/database/__test__/fake-repositories";
import { WorkspaceRepository } from "~/modules/workspaces/infrastructure/WorkspaceRepository";

import { requireOptionalProjectCapabilityAccess, requireWorkspaceAccess } from "../access";

function createContext(capabilityId: string) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    repositories: fakeRepositories([
      [
        WorkspaceRepository,
        {
          getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
          getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
          getMembership: vi.fn().mockResolvedValue({ role: "member" }),
          listProjectCapabilities: vi
            .fn()
            .mockResolvedValue([{ kind: "app", capability_id: capabilityId }]),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

function createWorkspaceContext({
  workspace = { id: "workspace-1" },
  membership = { role: "member" },
  project = { id: "project-1", workspace_id: "workspace-1" },
}: {
  workspace?: { id: string } | null;
  membership?: { role: string } | null;
  project?: { id: string; workspace_id: string } | null;
} = {}) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    repositories: fakeRepositories([
      [
        WorkspaceRepository,
        {
          getProject: vi.fn().mockResolvedValue(project),
          getWorkspace: vi.fn().mockResolvedValue(workspace),
          getMembership: vi.fn().mockResolvedValue(membership),
        },
      ],
    ]),
  } as unknown as ServiceContext;
}

describe("requireWorkspaceAccess", () => {
  it("rejects a user with no membership row", async () => {
    const context = createWorkspaceContext({ membership: null });

    await expect(requireWorkspaceAccess(context, "workspace-1")).rejects.toMatchObject({
      message: "Workspace not found",
      statusCode: 404,
    });
  });

  it("rejects a member whose role is not in the allowed roles", async () => {
    const context = createWorkspaceContext({ membership: { role: "member" } });

    await expect(
      requireWorkspaceAccess(context, "workspace-1", ["owner", "admin"]),
    ).rejects.toMatchObject({
      message: "You do not have access to this workspace",
      statusCode: 403,
    });
  });
});

describe("requireOptionalProjectCapabilityAccess", () => {
  it("lets a personal request through without touching project membership", async () => {
    const context = createContext("featured-recording-processor");

    await expect(
      requireOptionalProjectCapabilityAccess(
        context,
        undefined,
        "app",
        "featured-recording-processor",
      ),
    ).resolves.toBeUndefined();
    expect(context.repositories.get(WorkspaceRepository).getMembership).not.toHaveBeenCalled();
  });
});
