import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectConversationPage } from "./ProjectConversationPage";

const mocks = vi.hoisted(() => ({
	modeConfig: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("~/components/ConversationThread/ConversationPage", () => ({
	ConversationPage: ({ modeConfig }: { modeConfig: unknown }) => {
		mocks.modeConfig(modeConfig);
		return null;
	},
}));

vi.mock("~/hooks/useDynamicApps", () => ({
	useDynamicApps: () => ({
		data: { experiences: [], tools: [{ id: "web_fetch" }] },
	}),
}));

vi.mock("~/hooks/useWorkspaces", () => ({
	projectQueryKey: (projectId: string) => ["project", projectId],
	useProject: () => ({
		data: {
			capabilities: [],
			conversations: [],
			description: "Project description",
			name: "Project",
		},
	}),
}));

vi.mock("~/state/contexts/LoadingContext", () => ({
	useIsLoading: () => false,
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: (selector: (state: { currentConversationId?: string }) => unknown) =>
		selector({ currentConversationId: undefined }),
}));

vi.mock("./WorkSidebar", () => ({ WorkSidebar: () => null }));

describe("ProjectConversationPage", () => {
	it("derives assistant recipe routes from the dynamic app catalogue", () => {
		render(<ProjectConversationPage workspaceId="workspace-1" projectId="project-1" />);

		expect(mocks.modeConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				allowedAssistantActionCapabilityIds: ["web_fetch"],
				assistantActionRoutes: {
					recipes: "/work/workspace-1/projects/project-1/library",
				},
			}),
		);
	});
});
