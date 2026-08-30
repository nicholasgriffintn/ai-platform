import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceMembers } from "./WorkspaceMembers";

const revoke = vi.fn();

vi.mock("~/hooks/useAuth", () => ({
  useAuthStatus: () => ({ user: { id: "1" } }),
}));

vi.mock("~/hooks/useGovernance", () => ({
  useWorkspaceMemberMutations: () => ({
    leave: { isPending: false, mutateAsync: vi.fn() },
    remove: { isPending: false, mutateAsync: vi.fn() },
    transfer: { isPending: false, mutateAsync: vi.fn() },
    updateRole: { mutate: vi.fn() },
  }),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
  useInviteWorkspaceMember: () => ({
    data: undefined,
    error: null,
    isPending: false,
    mutateAsync: vi.fn(),
    reset: vi.fn(),
  }),
  useRevokeWorkspaceInvitation: () => ({
    isPending: false,
    mutate: revoke,
    variables: undefined,
  }),
}));

vi.mock("./WorkDataContext", () => ({
  useWorkData: () => ({
    workspaceQuery: {
      data: {
        id: "workspace-1",
        name: "Product",
        role: "owner",
        members: [],
        invitations: [
          {
            id: "invite-1",
            email: "member@example.com",
            expiresAt: "2026-08-18T00:00:00.000Z",
            role: "member",
            status: "pending",
          },
        ],
      },
      error: null,
      isLoading: false,
    },
  }),
}));

describe("WorkspaceMembers", () => {
  it("revokes a pending invitation through the workspace interface", () => {
    render(
      <MemoryRouter>
        <WorkspaceMembers workspaceId="workspace-1" />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

    expect(revoke).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      invitationId: "invite-1",
    });
  });
});
