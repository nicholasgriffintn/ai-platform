import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectOverview } from "./ProjectOverview";

vi.mock("./WorkContext", () => ({
	useWorkData: () => ({
		projectQuery: {
			data: {
				capabilities: [],
				capabilityCount: 0,
				conversationCount: 1,
				conversations: [
					{
						createdBy: { name: "Member" },
						id: "conversation-1",
						messageCount: 2,
						title: "Existing conversation",
					},
				],
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

describe("ProjectOverview", () => {
	it("presents new conversation as the primary project action", () => {
		render(
			<MemoryRouter>
				<ProjectOverview workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		expect(screen.getByRole("button", { name: "New conversation" })).toHaveClass("bg-blue-600");
	});
});
