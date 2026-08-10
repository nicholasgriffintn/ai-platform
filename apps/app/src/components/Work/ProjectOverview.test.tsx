import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { ProjectOverview } from "./ProjectOverview";

vi.mock("~/hooks/useWorkspaces", () => ({
	useProject: () => ({
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
	}),
	useWorkspace: () => ({ data: { role: "owner" } }),
}));
vi.mock("./ProjectBriefCard", () => ({ ProjectBriefCard: () => null }));
vi.mock("./WorkPageShell", () => ({
	WorkPageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

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
