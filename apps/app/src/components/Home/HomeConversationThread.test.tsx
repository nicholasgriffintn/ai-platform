import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HomeConversationThread } from "./HomeConversationThread";

const mocks = vi.hoisted(() => ({
	conversationThread: vi.fn(() => null),
}));

vi.mock("~/components/ConversationThread", () => ({
	ConversationThread: mocks.conversationThread,
}));

describe("HomeConversationThread", () => {
	beforeEach(() => {
		mocks.conversationThread.mockClear();
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
