import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationPage } from "./ConversationPage";

const mocks = vi.hoisted(() => ({
	clearCurrentConversation: vi.fn(),
	initializeStore: vi.fn().mockResolvedValue(undefined),
	setChatInput: vi.fn(),
	setSelectedTools: vi.fn(),
	setShowSearch: vi.fn(),
	startNewConversation: vi.fn(),
}));

vi.mock("~/components/ChatSidebar", () => ({ ChatSidebar: () => null }));
vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/components/Core/ProductModeHeader", () => ({ ProductModeHeader: () => null }));
vi.mock("~/components/Search/SearchDialog", () => ({ SearchDialog: () => null }));
vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: () => ({
		clearCurrentConversation: mocks.clearCurrentConversation,
		initializeStore: mocks.initializeStore,
		setChatInput: mocks.setChatInput,
		setShowSearch: mocks.setShowSearch,
		showSearch: false,
		startNewConversation: mocks.startNewConversation,
	}),
}));
vi.mock("~/state/stores/toolsStore", () => ({
	useToolsStore: () => ({ setSelectedTools: mocks.setSelectedTools }),
}));
vi.mock(".", () => ({ ConversationThread: () => null }));

describe("ConversationPage", () => {
	beforeEach(() => vi.clearAllMocks());

	it("clears a previous conversation when opening a clean project chat route", async () => {
		render(
			<MemoryRouter initialEntries={["/work/workspace-1/projects/project-1/chat"]}>
				<ConversationPage title="Project" />
			</MemoryRouter>,
		);

		await waitFor(() => expect(mocks.initializeStore).toHaveBeenCalledWith(undefined));
		expect(mocks.clearCurrentConversation).toHaveBeenCalledOnce();
	});
});
