import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectOverview } from "./ProjectOverview";

const mocks = vi.hoisted(() => ({
	archiveProject: vi.fn(async () => undefined),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	useArchiveProject: () => ({
		error: null,
		isPending: false,
		mutateAsync: mocks.archiveProject,
	}),
}));
vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		projectQuery: {
			data: {
				capabilities: [],
				capabilityCount: 0,
				conversationCount: 1,
				conversations: [],
				description: "Project description",
				instructions: "Project brief",
				name: "Project",
			},
			error: null,
			isLoading: false,
		},
		workspaceQuery: { data: { role: "owner" } },
		workspacesQuery: { data: { workspaces: [] } },
	}),
}));
vi.mock("./ProjectBriefCard", () => ({ ProjectBriefCard: () => null }));
vi.mock("./ProjectCodingEnvironmentCard", () => ({
	ProjectCodingEnvironmentCard: () => null,
}));

describe("ProjectOverview", () => {
	it("requires confirmation before an authorised user archives the project", async () => {
		render(
			<MemoryRouter>
				<ProjectOverview workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Archive" }));
		expect(
			screen.getByText(
				"Archive Project. Its conversations will no longer appear in this workspace.",
			),
		).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Archive project" }));

		await waitFor(() =>
			expect(mocks.archiveProject).toHaveBeenCalledWith({
				workspaceId: "workspace-1",
				projectId: "project-1",
			}),
		);
	});
});
