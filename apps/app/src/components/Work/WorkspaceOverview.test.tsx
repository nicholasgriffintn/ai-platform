import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
	it("keeps the primary workspace action visible and moves secondary actions into a menu", () => {
		render(
			<MemoryRouter>
				<WorkspaceOverview workspaceId="workspace-1" />
			</MemoryRouter>,
		);

		const workspaceActions = screen.getByRole("group", { name: "Workspace actions" });
		expect(workspaceActions).not.toHaveClass("flex-wrap");
		expect(within(workspaceActions).getByRole("button", { name: "New project" })).toHaveClass(
			"w-8",
			"xl:w-auto",
		);
		expect(within(workspaceActions).queryByRole("button", { name: "Delete" })).toBeNull();

		fireEvent.click(
			within(workspaceActions).getByRole("button", { name: "More workspace actions" }),
		);
		for (const name of ["Invite", "Delete"]) {
			expect(within(workspaceActions).getByRole("menuitem", { name })).toBeInTheDocument();
		}
	});

	it("requires confirmation before the owner deletes the workspace", async () => {
		render(
			<MemoryRouter>
				<WorkspaceOverview workspaceId="workspace-1" />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "More workspace actions" }));
		fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
		expect(
			screen.getByText(
				"Delete Acme and all of its projects, conversations, and invitations. This cannot be undone.",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Delete workspace" }));

		await waitFor(() => expect(mocks.deleteWorkspace).toHaveBeenCalledWith("workspace-1"));
	});
});
