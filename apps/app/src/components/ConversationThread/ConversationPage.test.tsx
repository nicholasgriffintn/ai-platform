import { render, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationPage } from "./ConversationPage";

const mocks = vi.hoisted(() => ({
	clearCurrentConversation: vi.fn(),
	initializeStore: vi.fn().mockResolvedValue(undefined),
	setChatInput: vi.fn(),
	setSelectedTools: vi.fn(),
	setShowSearch: vi.fn(),
	startNewConversation: vi.fn(),
	threadModeConfig: vi.fn(),
}));

vi.mock("~/components/ChatSidebar", () => ({ ChatSidebar: () => null }));
vi.mock("~/components/Core/PageShell", () => ({
	PageShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("~/components/Core/ProductModeHeader", () => ({ ProductModeHeader: () => null }));
vi.mock("./ConversationProductHeader", () => ({ ConversationProductHeader: () => null }));
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
vi.mock(".", () => ({
	ConversationThread: ({ modeConfig }: { modeConfig?: unknown }) => {
		mocks.threadModeConfig(modeConfig);
		return null;
	},
}));

describe("ConversationPage", () => {
	beforeEach(() => vi.clearAllMocks());
	afterEach(() => {
		vi.restoreAllMocks();
		window.history.replaceState({}, "", "/");
	});

	it("clears a previous conversation when opening a clean project chat route", async () => {
		render(
			<MemoryRouter initialEntries={["/work/workspace-1/projects/project-1/chat"]}>
				<ConversationPage title="Project" />
			</MemoryRouter>,
		);

		await waitFor(() => expect(mocks.initializeStore).toHaveBeenCalledWith(undefined));
		expect(mocks.clearCurrentConversation).toHaveBeenCalledOnce();
	});

	it("starts an auto-submitted conversation once when mount effects are replayed", async () => {
		render(
			<StrictMode>
				<MemoryRouter
					initialEntries={[
						"/work/workspace-1/projects/project-1/chat?query=Run+the+recipe&auto_submit=1",
					]}
				>
					<ConversationPage title="Project" />
				</MemoryRouter>
			</StrictMode>,
		);

		await waitFor(() => expect(mocks.startNewConversation).toHaveBeenCalled());
		expect(mocks.startNewConversation).toHaveBeenCalledOnce();
	});

	it("passes a plain project prompt to the conversation for automatic submission", async () => {
		render(
			<MemoryRouter
				initialEntries={[
					"/work/workspace-1/projects/project-1/chat?query=Prepare+the+launch+brief&auto_submit=1&enabled_tools=",
				]}
			>
				<ConversationPage title="Project" />
			</MemoryRouter>,
		);

		await waitFor(() =>
			expect(mocks.threadModeConfig).toHaveBeenLastCalledWith(
				expect.objectContaining({
					initialAutoSubmit: expect.objectContaining({
						input: "Prepare the launch brief",
					}),
				}),
			),
		);
	});

	it("does not restore a consumed recipe prompt after refresh", async () => {
		const replaceState = vi.spyOn(window.history, "replaceState");
		const prompt = "Run the planner recipe";
		const page = render(
			<MemoryRouter
				initialEntries={[
					`/work/workspace-1/projects/project-1/chat?query=${encodeURIComponent(prompt)}&enabled_tools=use_recipe_connector&auto_submit=1&assistant_action_context=%7B%7D`,
				]}
			>
				<ConversationPage title="Project" />
			</MemoryRouter>,
		);

		await waitFor(() => expect(replaceState).toHaveBeenCalled());
		const refreshedUrl = String(replaceState.mock.calls.at(-1)?.[2]);
		page.unmount();
		vi.clearAllMocks();

		render(
			<MemoryRouter initialEntries={[refreshedUrl]}>
				<ConversationPage title="Project" />
			</MemoryRouter>,
		);

		await waitFor(() => expect(mocks.initializeStore).toHaveBeenCalled());
		expect(mocks.setChatInput).not.toHaveBeenCalledWith(prompt);
	});
});
