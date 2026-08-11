import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceMembers } from "./WorkspaceMembers";

const revoke = vi.fn();

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

vi.mock("./WorkContext", () => ({
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
		render(<WorkspaceMembers workspaceId="workspace-1" />);

		fireEvent.click(screen.getByRole("button", { name: "Revoke" }));

		expect(revoke).toHaveBeenCalledWith({
			workspaceId: "workspace-1",
			invitationId: "invite-1",
		});
	});
});
