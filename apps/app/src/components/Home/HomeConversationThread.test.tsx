import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeConversationThread } from "./HomeConversationThread";

const mocks = vi.hoisted(() => ({
	conversationThread: vi.fn(() => null),
	conversations: [] as Array<{ title: string }>,
	areConversationsLoading: false,
	chatState: {
		user: null as { name: string; message_count?: number } | null,
		userSettings: null as { nickname: string; job_role: string } | null,
		isAuthenticationLoading: false,
	},
}));

vi.mock("~/components/ConversationThread", () => ({
	ConversationThread: mocks.conversationThread,
}));

vi.mock("~/hooks/useChat", () => ({
	useChats: () => ({
		data: mocks.conversations,
		isLoading: mocks.areConversationsLoading,
	}),
}));

vi.mock("~/state/stores/chatStore", () => ({
	useChatStore: (selector: (state: typeof mocks.chatState) => unknown) => selector(mocks.chatState),
}));

describe("HomeConversationThread", () => {
	beforeEach(() => {
		mocks.conversationThread.mockClear();
		mocks.conversations = [];
		mocks.areConversationsLoading = false;
		mocks.chatState.user = null;
		mocks.chatState.userSettings = null;
		mocks.chatState.isAuthenticationLoading = false;
		vi.spyOn(Math, "random").mockReturnValue(0);
	});

	it("uses a whimsical welcome for a new personal chat", () => {
		render(<HomeConversationThread />);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.objectContaining({
					welcomeTitle: "What’s on your mind?",
					welcomeDescription:
						"Bring a question, a rough idea, or something you want to work through.",
				}),
			},
			undefined,
		);
	});

	it("personalises the welcome from the existing chat profile", () => {
		mocks.chatState.user = { name: "Nicholas Griffin", message_count: 12 };
		mocks.chatState.userSettings = {
			nickname: "Nick",
			job_role: "Senior Software Engineer",
		};

		render(<HomeConversationThread />);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.objectContaining({
					welcomeTitle: "What are we taking apart, Nick?",
					welcomeDescription:
						"Code knot, system puzzle, or the suspiciously simple thing that isn’t.",
				}),
			},
			undefined,
		);
	});

	it("keeps the welcome reserved until personal context has loaded", () => {
		mocks.chatState.isAuthenticationLoading = true;
		mocks.areConversationsLoading = true;

		render(<HomeConversationThread />);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.objectContaining({ welcomeLoading: true }),
			},
			undefined,
		);
	});

	it("preserves the intentional welcome for specialised chat modes", () => {
		render(
			<HomeConversationThread
				urlModeConfig={{
					welcomeTitle: "Start a live session",
					welcomeDescription: "Choose a voice and begin when you’re ready.",
				}}
			/>,
		);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.objectContaining({
					welcomeTitle: "Start a live session",
					welcomeDescription: "Choose a voice and begin when you’re ready.",
					welcomeLoading: false,
				}),
			},
			undefined,
		);
	});

	it("keeps the shared composer action menu available in personal chat", () => {
		render(<HomeConversationThread />);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.not.objectContaining({ hideComposerActionMenu: true }),
			},
			undefined,
		);
	});

	it("preserves modes that intentionally hide the composer action menu", () => {
		render(<HomeConversationThread urlModeConfig={{ hideComposerActionMenu: true }} />);

		expect(mocks.conversationThread).toHaveBeenCalledWith(
			{
				modeConfig: expect.objectContaining({ hideComposerActionMenu: true }),
			},
			undefined,
		);
	});
});
