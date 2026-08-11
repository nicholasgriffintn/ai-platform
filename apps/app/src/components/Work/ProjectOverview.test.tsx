import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("~/hooks/useGovernance", () => ({
	useTemplateMutations: () => ({
		create: { isPending: false, mutateAsync: vi.fn() },
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
vi.mock("./ProjectBriefCard", () => ({
	ProjectBriefCard: () => <section data-testid="project-detail">Brief</section>,
}));
vi.mock("./ProjectCodingEnvironmentCard", () => ({
	ProjectCodingEnvironmentCard: () => <section data-testid="project-detail">Repository</section>,
}));
vi.mock("./ProjectConversationStarter", () => ({
	ProjectConversationStarter: () => <div>Project conversation starter</div>,
}));
vi.mock("./ProjectKnowledgeCard", () => ({
	ProjectKnowledgeCard: () => (
		<>
			<section data-testid="project-detail">Memory</section>
			<section data-testid="project-detail">Context</section>
		</>
	),
}));
vi.mock("./ProjectSchedulesCard", () => ({
	ProjectSchedulesCard: () => <section data-testid="project-detail">Recipes</section>,
}));
vi.mock("./ProjectCapabilitiesCard", () => ({
	ProjectCapabilitiesCard: () => <section data-testid="project-detail">Capabilities</section>,
}));

describe("ProjectOverview", () => {
	it("joins project details into one panel with the brief first", () => {
		render(
			<MemoryRouter>
				<ProjectOverview workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		const details = screen.getByRole("complementary");
		expect(details.firstElementChild).toHaveClass("gap-0", "overflow-hidden");
		expect(
			within(details)
				.getAllByTestId("project-detail")
				.map((item) => item.textContent),
		).toEqual(["Brief", "Memory", "Context", "Recipes", "Repository", "Capabilities"]);
	});

	it("wraps project actions without compressing their labels", () => {
		render(
			<MemoryRouter>
				<ProjectOverview workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		const projectActions = screen.getByRole("group", { name: "Project actions" });
		expect(projectActions).toHaveClass("max-w-full", "flex-wrap");
		for (const name of ["Save template", "Archive", "Capabilities", "New conversation"]) {
			expect(within(projectActions).getByRole("button", { name })).toHaveClass("whitespace-nowrap");
		}
	});

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
