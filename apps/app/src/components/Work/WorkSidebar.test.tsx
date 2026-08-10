import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChatStore } from "~/state/stores/chatStore";
import { useUIStore } from "~/state/stores/uiStore";
import { WorkSidebar } from "./WorkSidebar";

vi.mock("~/components/Sidebar/SidebarFooter", () => ({
	SidebarFooter: () => null,
}));

vi.mock("~/components/Sidebar/SidebarHeader", () => ({
	SidebarHeader: () => <div>Polychat</div>,
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	useProject: () => ({
		data: {
			id: "project-1",
			conversations: [
				{
					id: "conversation-1",
					title: "Existing project chat",
					createdAt: "2026-08-10T10:00:00.000Z",
					updatedAt: null,
					lastMessageAt: null,
					messageCount: 2,
					createdBy: { id: 1, name: "Nicholas", avatarUrl: null },
				},
			],
		},
	}),
	useWorkspace: () => ({
		data: {
			id: "workspace-1",
			name: "Product",
			projects: [
				{
					id: "project-1",
					name: "Work navigation",
					colour: "#2563EB",
				},
			],
		},
	}),
	useWorkspaces: () => ({ data: { workspaces: [] } }),
}));

describe("WorkSidebar", () => {
	beforeEach(() => {
		useUIStore.setState({ isMobile: false, sidebarVisible: true });
		useChatStore.setState({ currentConversationId: "conversation-1" });
	});

	it("lists project conversations and highlights the selected conversation instead of New conversation", () => {
		render(
			<MemoryRouter
				initialEntries={["/work/workspace-1/projects/project-1/chat?completion_id=conversation-1"]}
			>
				<WorkSidebar workspaceId="workspace-1" projectId="project-1" />
			</MemoryRouter>,
		);

		expect(screen.getByRole("link", { name: "Existing project chat" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		expect(screen.getByRole("link", { name: "New conversation" })).not.toHaveAttribute(
			"aria-current",
		);
	});
});
