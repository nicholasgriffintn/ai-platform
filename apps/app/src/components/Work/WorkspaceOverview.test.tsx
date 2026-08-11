import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceOverview } from "./WorkspaceOverview";

const mocks = vi.hoisted(() => ({
	deleteWorkspace: vi.fn(async () => undefined),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	useDeleteWorkspace: () => ({
		error: null,
		isPending: false,
		mutateAsync: mocks.deleteWorkspace,
	}),
}));
vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		workspaceQuery: {
			data: {
				description: "Workspace description",
				invitations: [],
				memberCount: 1,
				name: "Acme",
				projects: [],
				role: "owner",
			},
			error: null,
			isLoading: false,
		},
	}),
}));
vi.mock("./CreateProjectDialog", () => ({ CreateProjectDialog: () => null }));
vi.mock("./InviteMemberDialog", () => ({ InviteMemberDialog: () => null }));

describe("WorkspaceOverview", () => {
	it("requires confirmation before the owner deletes the workspace", async () => {
		render(
			<MemoryRouter>
				<WorkspaceOverview workspaceId="workspace-1" />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Delete" }));
		expect(
			screen.getByText(
				"Delete Acme and all of its projects, conversations, and invitations. This cannot be undone.",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));

		await waitFor(() => expect(mocks.deleteWorkspace).toHaveBeenCalledWith("workspace-1"));
	});
});
