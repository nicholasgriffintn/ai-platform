import { describe, expect, it, vi } from "vitest";

import type { ServiceContext } from "~/lib/context/serviceContext";

import {
  requireProjectAccess,
  requireProjectCapabilityAccess,
  requireWorkAccess,
  requireWorkspaceAccess,
} from "../access";

function createContext(capabilityId: string) {
  return {
    requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "pro" }),
    repositories: {
      workspaces: {
        getProject: vi.fn().mockResolvedValue({ id: "project-1", workspace_id: "workspace-1" }),
        getWorkspace: vi.fn().mockResolvedValue({ id: "workspace-1" }),
        getMembership: vi.fn().mockResolvedValue({ role: "member" }),
        listProjectCapabilities: vi
          .fn()
          .mockResolvedValue([{ kind: "app", capability_id: capabilityId }]),
      },
    },
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
    repositories: {
      workspaces: {
        getProject: vi.fn().mockResolvedValue(project),
        getWorkspace: vi.fn().mockResolvedValue(workspace),
        getMembership: vi.fn().mockResolvedValue(membership),
      },
    },
  } as unknown as ServiceContext;
}

describe("requireWorkAccess", () => {
  it("rejects signed-in users without a Pro entitlement", () => {
    const context = {
      requireUser: vi.fn().mockReturnValue({ id: 7, plan_id: "free" }),
    } as unknown as ServiceContext;

    expect(() => requireWorkAccess(context)).toThrow(
      expect.objectContaining({
        message: "Workspaces require a Pro plan",
        statusCode: 403,
      }),
    );
  });
});

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

describe("requireProjectAccess", () => {
  it("404s for a non-existent project before checking workspace role", async () => {
    const context = createWorkspaceContext({ project: null });

    await expect(requireProjectAccess(context, "missing-project")).rejects.toMatchObject({
      message: "Project not found",
      statusCode: 404,
    });
    expect(context.repositories.workspaces.getWorkspace).not.toHaveBeenCalled();
    expect(context.repositories.workspaces.getMembership).not.toHaveBeenCalled();
  });
});

describe("requireProjectCapabilityAccess", () => {
  it("allows members to use an enabled project capability", async () => {
    await expect(
      requireProjectCapabilityAccess(
        createContext("featured-note-taker"),
        "project-1",
        "app",
        "featured-note-taker",
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects a capability that is not enabled for the project", async () => {
    await expect(
      requireProjectCapabilityAccess(
        createContext("featured-strudel"),
        "project-1",
        "app",
        "featured-note-taker",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
